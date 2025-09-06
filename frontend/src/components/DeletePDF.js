import React, { useState } from "react";
import axios from "axios";

function DeletePagePDF() {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState("");
  const [resultUrl, setResultUrl] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setResultUrl(null);
  };

  const handlePagesChange = (e) => {
    setPages(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !pages) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("pages", pages); // e.g. "1,3,5" to delete pages 1, 3, 5

    const response = await axios.post("http://localhost:8000/delete-pages", formData, {
      responseType: "blob",
      headers: { "Content-Type": "multipart/form-data" },
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    setResultUrl(url);
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>Delete Pages from PDF</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          required
        />
        <div style={{ margin: "10px 0" }}>
          <label>
            Pages to delete (comma separated, e.g. 1,3,5):{" "}
            <input
              type="text"
              value={pages}
              onChange={handlePagesChange}
              placeholder="e.g. 1,3,5"
              required
            />
          </label>
        </div>
        <button type="submit" disabled={!file || !pages}>
          Delete Pages
        </button>
      </form>
      {resultUrl && (
        <div style={{ marginTop: 20 }}>
          <a href={resultUrl} download="deleted_pages.pdf">
            Download PDF without selected pages
          </a>
        </div>
      )}
    </div>
  );
}

export default DeletePagePDF;