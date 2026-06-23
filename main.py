from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from PyPDF2 import PdfMerger, PdfReader, PdfWriter
import os
import shutil
import subprocess
import uuid
import io
import re
from pathlib import Path

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development only; restrict in production!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

PDF_EXTENSIONS = {".pdf"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}
IMAGE_CONTENT_TYPES = {"image/png", "image/jpeg"}
OFFICE_EXTENSIONS = {".doc", ".docx", ".ppt", ".pptx"}
OFFICE_CONTENT_TYPES = {
    "application/msword",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}


def remove_file(path: str):
    try:
        os.remove(path)
    except Exception as e:
        print(f"Error deleting file {path}: {e}")


def get_upload_kind(file: UploadFile) -> str:
    filename = file.filename or ""
    extension = os.path.splitext(filename)[1].lower()
    content_type = (file.content_type or "").lower()

    if extension in PDF_EXTENSIONS or content_type == "application/pdf":
        return "pdf"
    if extension in IMAGE_EXTENSIONS or content_type in IMAGE_CONTENT_TYPES:
        return "image"
    if extension in OFFICE_EXTENSIONS or content_type in OFFICE_CONTENT_TYPES:
        return "office"

    raise HTTPException(
        status_code=400,
        detail=f"Unsupported file type for {filename or 'upload'}. Use PDF, PNG, JPG, JPEG, DOC, DOCX, PPT, or PPTX files.",
    )


def image_to_pdf(image_path: str, output_path: str):
    try:
        from PIL import Image, UnidentifiedImageError
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Image conversion requires Pillow. Run: pip install -r requirements.txt",
        ) from exc

    try:
        with Image.open(image_path) as image:
            image.load()

            has_alpha = image.mode in ("RGBA", "LA") or (
                image.mode == "P" and "transparency" in image.info
            )
            if has_alpha:
                rgba = image.convert("RGBA")
                pdf_image = Image.new("RGB", rgba.size, "white")
                pdf_image.paste(rgba, mask=rgba.getchannel("A"))
                rgba.close()
            else:
                pdf_image = image.convert("RGB")

            pdf_image.save(output_path, "PDF", resolution=100.0)
            pdf_image.close()
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read image file {os.path.basename(image_path)}.",
        ) from exc


def find_soffice_path() -> str | None:
    candidates = [
        os.environ.get("LIBREOFFICE_PATH"),
        shutil.which("soffice"),
        shutil.which("libreoffice"),
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ]

    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return candidate
    return None


def office_to_pdf(input_path: str, output_dir: str) -> str:
    soffice_path = find_soffice_path()
    if not soffice_path:
        raise HTTPException(
            status_code=500,
            detail=(
                "DOC/PPT conversion requires LibreOffice. Install LibreOffice, "
                "or set LIBREOFFICE_PATH to soffice.exe."
            ),
        )

    profile_dir = os.path.abspath(os.path.join(UPLOAD_DIR, f"lo_profile_{uuid.uuid4()}"))
    os.makedirs(profile_dir, exist_ok=True)

    try:
        command = [
            soffice_path,
            "--headless",
            f"-env:UserInstallation={Path(profile_dir).as_uri()}",
            "--convert-to",
            "pdf",
            "--outdir",
            os.path.abspath(output_dir),
            os.path.abspath(input_path),
        ]
        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=120,
        )

        output_pdf = os.path.join(
            output_dir,
            f"{os.path.splitext(os.path.basename(input_path))[0]}.pdf",
        )
        if result.returncode != 0 or not os.path.exists(output_pdf):
            message = (result.stderr or result.stdout or "LibreOffice did not create a PDF.").strip()
            raise HTTPException(
                status_code=500,
                detail=f"Failed to convert {os.path.basename(input_path)} to PDF: {message}",
            )

        return output_pdf
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Timed out while converting {os.path.basename(input_path)} to PDF.",
        ) from exc
    finally:
        shutil.rmtree(profile_dir, ignore_errors=True)


@app.post("/merge")
async def merge_pdfs(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    criteria: str = Form("chronology"),
    regex: str = Form(None)
):
    temp_paths = []
    upload_items = []
    try:
        for file in files:
            kind = get_upload_kind(file)
            original_filename = os.path.basename(file.filename or "upload")
            temp_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{original_filename}")
            temp_paths.append(temp_path)
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            upload_items.append({
                "path": temp_path,
                "filename": original_filename,
                "kind": kind,
            })
    except Exception:
        for temp in temp_paths:
            remove_file(temp)
        raise

    try:
        # Sorting logic
        if criteria == "name":
            upload_items.sort(key=lambda item: item["filename"].lower())
        elif criteria == "number":
            def extract_number(filename):
                import re
                match = re.search(r"(\d+)", filename)
                return int(match.group(1)) if match else 0

            upload_items.sort(key=lambda item: extract_number(item["filename"]))

        elif criteria == "date":
            def extract_date(filename):
                import re, datetime
                match = re.search(r"(\d{4}-\d{2}-\d{2})", filename)
                if match:
                    try:
                        return datetime.datetime.strptime(match.group(1), "%Y-%m-%d")
                    except ValueError:
                        return datetime.datetime.min
                return datetime.datetime.min

            upload_items.sort(key=lambda item: extract_date(item["filename"]))
            
        elif criteria == "regex" and regex:
            try:
                pattern = re.compile(regex)
            except re.error as exc:
                raise HTTPException(status_code=400, detail=f"Invalid regex: {exc}") from exc

            def extract_key(filename):
                match = pattern.search(filename)
                if not match:
                    return (1, filename.lower())

                value = match.group(1) if match.groups() else match.group(0)
                try:
                    return (0, int(value))
                except ValueError:
                    return (0, value.lower())
            upload_items.sort(key=lambda item: extract_key(item["filename"]))
        # else: chronology = upload order (do nothing)
    except Exception:
        for temp in temp_paths:
            remove_file(temp)
        raise

    merger = PdfMerger()
    output_path = None
    try:
        for item in upload_items:
            append_path = item["path"]
            if item["kind"] == "image":
                append_path = os.path.join(UPLOAD_DIR, f"image_{uuid.uuid4()}.pdf")
                image_to_pdf(item["path"], append_path)
                temp_paths.append(append_path)
            elif item["kind"] == "office":
                append_path = office_to_pdf(item["path"], UPLOAD_DIR)
                temp_paths.append(append_path)

            try:
                merger.append(append_path)
            except Exception as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Could not merge {item['filename']}. Make sure it is a valid PDF, image, Word, or PowerPoint file.",
                ) from exc

        output_path = os.path.join(UPLOAD_DIR, f"merged_{uuid.uuid4()}.pdf")
        merger.write(output_path)
    except Exception:
        if output_path and os.path.exists(output_path):
            remove_file(output_path)
        raise
    finally:
        merger.close()
        for temp in temp_paths:
            remove_file(temp)

    background_tasks.add_task(remove_file, output_path)
    return FileResponse(output_path, filename="merged.pdf", media_type="application/pdf")


@app.post("/compress")
async def compress_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    quality: str = Form("screen")
):
    # Use Ghostscript for compression (must be installed on the server)
    input_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
    output_path = os.path.join(UPLOAD_DIR, f"compressed_{uuid.uuid4()}.pdf")
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    gs_path = r"C:\Program Files\gs\gs10.06.0\bin\gswin64c.exe"
    command = [
        gs_path,
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        f"-dPDFSETTINGS=/{quality}",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        f"-sOutputFile={output_path}",
        input_path
    ]
    import subprocess
    subprocess.run(command, check=True)
    os.remove(input_path)
    background_tasks.add_task(remove_file, output_path)
    return FileResponse(output_path, filename="compressed.pdf", media_type="application/pdf")


def parse_pages(spec: str, total_pages: int) -> list[int]:
    # supports "1,3-5, 7"
    pages = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        m = re.match(r"^(\d+)\s*-\s*(\d+)$", part)
        if m:
            start = int(m.group(1))
            end = int(m.group(2))
            if start > end:
                start, end = end, start
            for p in range(start, end + 1):
                if 1 <= p <= total_pages:
                    pages.add(p - 1)  # zero-based
        elif part.isdigit():
            p = int(part)
            if 1 <= p <= total_pages:
                pages.add(p - 1)
    return sorted(pages)


@app.post("/split")
async def split_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile=File(...),
    pages: str=Form("1")
):
    # Save upload to a temp path
    input_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        reader = PdfReader(input_path)
        page_indices = parse_pages(pages, len(reader.pages))

        if not page_indices:
            return {"error": "No valid pages selected."}

        writer = PdfWriter()
        for idx in page_indices:
            writer.add_page(reader.pages[idx])

        # Write to memory and stream back
        buf = io.BytesIO()
        writer.write(buf)
        buf.seek(0)

        # stream response; no file path races, no background cleanup needed
        headers = {"Content-Disposition": 'attachment; filename="split.pdf"'}
        return StreamingResponse(buf, media_type="application/pdf", headers=headers)
    finally:
        # Always remove uploaded temp file
        try:
            os.remove(input_path)
        except FileNotFoundError:
            pass


@app.post("/delete-pages")
async def delete_pages(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    pages: str = Form("1")
):
    # pages: comma-separated, e.g. "1,3,5" (pages to delete)
    input_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
    output_path = os.path.join(UPLOAD_DIR, f"deleted_{uuid.uuid4()}.pdf")
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    reader = PdfReader(input_path)
    writer = PdfWriter()
    delete_set = set(int(p.strip()) - 1 for p in pages.split(",") if p.strip().isdigit())
    for i in range(len(reader.pages)):
        if i not in delete_set:
            writer.add_page(reader.pages[i])
    with open(output_path, "wb") as f:
        writer.write(f)
    os.remove(input_path)
    background_tasks.add_task(remove_file, output_path)
    return FileResponse(output_path, filename="deleted_pages.pdf", media_type="application/pdf")


@app.post("/rotate")
async def rotate_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    angle: int = Form(90)
):
    # Rotate all pages by the specified angle (90, 180, 270)
    input_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
    output_path = os.path.join(UPLOAD_DIR, f"rotated_{uuid.uuid4()}.pdf")
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        reader = PdfReader(input_path)
        writer = PdfWriter()
        
        for page in reader.pages:
            page.rotate(angle)
            writer.add_page(page)
        
        with open(output_path, "wb") as f:
            writer.write(f)
        
        os.remove(input_path)
        background_tasks.add_task(remove_file, output_path)
        return FileResponse(output_path, filename="rotated.pdf", media_type="application/pdf")
    except Exception as e:
        if os.path.exists(input_path):
            os.remove(input_path)
        raise e
