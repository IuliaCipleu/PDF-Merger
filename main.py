from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from PyPDF2 import PdfMerger, PdfReader, PdfWriter
import os
import shutil
import uuid
import io
import re

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


def remove_file(path: str):
    try:
        os.remove(path)
    except Exception as e:
        print(f"Error deleting file {path}: {e}")


@app.post("/merge")
async def merge_pdfs(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    criteria: str = Form("chronology"),
    regex: str = Form(None)
):
    temp_files = []
    for file in files:
        temp_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        temp_files.append(temp_path)

    # Sorting logic
    if criteria == "name":
        temp_files.sort(key=lambda x: os.path.basename(x).lower())
    elif criteria == "number":
        def extract_number(filename):
            import re
            match = re.search(r"(\d+)", os.path.basename(filename))
            return int(match.group(1)) if match else 0

        temp_files.sort(key=extract_number)

    elif criteria == "date":
        def extract_date(filename):
            import re, datetime
            match = re.search(r"(\d{4}-\d{2}-\d{2})", os.path.basename(filename))
            if match:
                try:
                    return datetime.datetime.strptime(match.group(1), "%Y-%m-%d")
                except ValueError:
                    return datetime.datetime.min
            return datetime.datetime.min

        temp_files.sort(key=extract_date)
        
    elif criteria == "regex" and regex:
        def extract_key(filename):
            match = re.search(regex, os.path.basename(filename))
            if match:
                # Try to convert first group to int, else use as string
                try:
                    return int(match.group(1))
                except Exception:
                    return match.group(1)
            return os.path.basename(filename)
        temp_files.sort(key=extract_key)
    # else: chronology = upload order (do nothing)

    merger = PdfMerger()
    for path in temp_files:
        merger.append(path)
    output_path = os.path.join(UPLOAD_DIR, f"merged_{uuid.uuid4()}.pdf")
    merger.write(output_path)
    merger.close()
    for temp in temp_files:
        os.remove(temp)
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
    gs_path = r"C:\Program Files\gs\gs10.05.1\bin\gswin64c.exe"
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
