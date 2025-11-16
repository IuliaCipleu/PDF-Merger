# PDF-Merger

PDF-Merger is a user-friendly application for merging, splitting, compressing, and deleting pages from PDF files. It features a modern web interface and a Python backend, making PDF manipulation simple and accessible.

## Features

- **Merge PDFs:** Combine multiple PDF files into one.
- **Split PDFs:** Extract selected pages into a new PDF.
- **Compress PDFs:** Reduce PDF file size for easier sharing.
- **Delete Pages:** Remove unwanted pages from your PDFs.
- **Preview:** See a preview of the resulting PDF before downloading.

## Technology Stack

- **Frontend:** React (located in `frontend/`)
- **Backend:** Python (see `main.py`)
- **PDF Processing:** PyPDF2

## Getting Started

### 1. Clone the repository

```sh
git clone https://github.com/IuliaCipleu/pdf-merger.git
cd pdf-merger
```

### 2. Backend Setup

Install Python dependencies:

```sh
pip install -r requirements.txt
```

Run the backend server:

```sh
uvicorn main:app --reload
```

### 3. Frontend Setup

Navigate to the frontend directory and install dependencies:

```sh
cd frontend
npm install
```

Start the frontend development server:

```sh
npm start
```

The frontend will typically run at [http://localhost:3000](http://localhost:3000).

---

## Usage

1. Open the web app in your browser.
2. Select the desired PDF operation from the menu.
3. Upload your PDF files.
4. Preview the result.
5. Download the processed PDF.

---

## Folder Structure

```
frontend/   # React frontend
main.py               # Python backend
requirements.txt      # Python dependencies
README.md             # Project documentation
```

---

## License

This project is licensed under the MIT License.
