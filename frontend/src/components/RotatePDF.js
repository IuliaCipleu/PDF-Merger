import React, { useState, useEffect } from "react";
import axios from "axios";

function RotatePDF() {
  const [file, setFile] = useState(null);
  const [rotatedUrl, setRotatedUrl] = useState(null);
  const [angle, setAngle] = useState(90);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (rotatedUrl) URL.revokeObjectURL(rotatedUrl);
    };
  }, [rotatedUrl]);

  const handleFiles = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (rotatedUrl) {
        URL.revokeObjectURL(rotatedUrl);
        setRotatedUrl(null);
      }
    }
  };

  const handleDropZoneDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type === "application/pdf") {
      setFile(dropped);
      if (rotatedUrl) {
        URL.revokeObjectURL(rotatedUrl);
        setRotatedUrl(null);
      }
    }
  };

  const handleDropZoneDragOver = (e) => e.preventDefault();

  const handleRotate = async () => {
    if (!file) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("angle", angle);

    try {
      const response = await axios.post(
        "http://localhost:8000/rotate",
        formData,
        {
          responseType: "blob",
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      if (rotatedUrl) URL.revokeObjectURL(rotatedUrl);
      setRotatedUrl(url);
    } catch (error) {
      alert("Error rotating PDF: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (rotatedUrl) {
      const link = document.createElement("a");
      link.href = rotatedUrl;
      link.download = `rotated_${file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div
      style={{
        padding: 40,
        maxWidth: 720,
        margin: "0 auto",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h2>Rotate PDF</h2>

      <div
        onDrop={handleDropZoneDrop}
        onDragOver={handleDropZoneDragOver}
        style={{
          border: "2px dashed #ccc",
          borderRadius: 8,
          padding: 40,
          textAlign: "center",
          cursor: "pointer",
          backgroundColor: "#f9f9f9",
          marginBottom: 20,
        }}
      >
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFiles}
          style={{ display: "none" }}
          id="file-input"
        />
        <label
          htmlFor="file-input"
          style={{ cursor: "pointer", display: "block" }}
        >
          <p style={{ margin: 0, fontSize: 16, color: "#666" }}>
            {file ? `Selected: ${file.name}` : "Drop PDF here or click to select"}
          </p>
        </label>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
          Rotation Angle:
        </label>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            value={angle}
            onChange={(e) => setAngle(Number(e.target.value))}
            disabled={!file}
            style={{
              padding: 10,
              borderRadius: 4,
              border: "1px solid #ddd",
              fontSize: 14,
              flex: 1,
            }}
          >
            <option value={90}>90° Clockwise</option>
            <option value={180}>180°</option>
            <option value={270}>270° Clockwise (90° Counter-clockwise)</option>
          </select>
        </div>
      </div>

      <button
        onClick={handleRotate}
        disabled={!file || loading}
        style={{
          padding: "10px 20px",
          backgroundColor: file && !loading ? "#007bff" : "#ccc",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: file && !loading ? "pointer" : "not-allowed",
          fontSize: 16,
          marginBottom: 20,
          width: "100%",
        }}
      >
        {loading ? "Processing..." : "Rotate PDF"}
      </button>

      {rotatedUrl && (
        <div>
          <p style={{ color: "green", fontWeight: "bold" }}>
            ✓ PDF rotated successfully!
          </p>
          <button
            onClick={handleDownload}
            style={{
              padding: "10px 20px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 16,
              width: "100%",
            }}
          >
            Download Rotated PDF
          </button>
        </div>
      )}
    </div>
  );
}

export default RotatePDF;
