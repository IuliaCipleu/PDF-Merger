import React, { useState } from "react";
import axios from "axios";

function CompressPDF() {
  const [file, setFile] = useState(null);
  const [quality, setQuality] = useState("screen");
  const [resultUrl, setResultUrl] = useState(null);
  const [finalFileName, setFinalFileName] = useState('merged.pdf'); // Default file name

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setResultUrl(null);
  };

  const handleQualityChange = (e) => {
    setQuality(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("quality", quality);

    const response = await axios.post("http://localhost:8000/compress", formData, {
      responseType: "blob",
      headers: { "Content-Type": "multipart/form-data" },
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    setResultUrl(url);
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>Compress PDF</h2>
      {/* Final file name input */}
            <div style={{ marginBottom: 16 }}>
                <label>
                    Final file name:&nbsp;
                    <input
                        type="text"
                        value={finalFileName}
                        onChange={(e) => setFinalFileName(e.target.value)}
                        placeholder="Enter final file name"
                        style={{ padding: 8, borderRadius: 4, border: "1px solid #ddd", width: "100%" }}
                    />
                </label>
            </div>
      <form onSubmit={handleSubmit}>
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          required
        />
        <div style={{ margin: "10px 0" }}>
          <label>
            Quality:&nbsp;
            <select value={quality} onChange={handleQualityChange}>
              <option value="screen">Screen (smallest)</option>
              <option value="ebook">eBook (medium)</option>
              <option value="printer">Printer (high)</option>
              <option value="prepress">Prepress (very high)</option>
            </select>
          </label>
        </div>
        <button type="submit" disabled={!file}>
          Compress PDF
        </button>
      </form>
      {resultUrl && (
        <div style={{ marginTop: 20 }}>
          <a href={resultUrl} download={finalFileName}>
            Download Compressed PDF
          </a>
        </div>
      )}
    </div>
  );
}
export default CompressPDF;