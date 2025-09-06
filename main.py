from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from PyPDF2 import PdfMerger, PdfReader, PdfWriter
import os
import shutil
import uuid
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


@app.post("/merge")
async def merge_pdfs(
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
    return FileResponse(output_path, filename="merged.pdf", media_type="application/pdf")


@app.post("/compress")
async def compress_pdf(
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
    return FileResponse(output_path, filename="compressed.pdf", media_type="application/pdf")


@app.post("/split")
async def split_pdf(
    file: UploadFile = File(...),
    pages: str = Form("1")
):
    # pages: comma-separated, e.g. "1,2"
    input_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    reader = PdfReader(input_path)
    page_numbers = [int(p.strip()) - 1 for p in pages.split(",") if p.strip().isdigit()]
    output_files = []
    for idx, page_num in enumerate(page_numbers):
        writer = PdfWriter()
        if 0 <= page_num < len(reader.pages):
            writer.add_page(reader.pages[page_num])
            out_path = os.path.join(UPLOAD_DIR, f"split_{idx+1}_{uuid.uuid4()}.pdf")
            with open(out_path, "wb") as f:
                writer.write(f)
            output_files.append(out_path)
    os.remove(input_path)
    # For simplicity, return the first split file (extend as needed)
    if output_files:
        return FileResponse(output_files[0], filename="split.pdf", media_type="application/pdf")
    return {"error": "No valid pages selected."}


@app.post("/delete-pages")
async def delete_pages(
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
    return FileResponse(output_path, filename="deleted_pages.pdf", media_type="application/pdf")
