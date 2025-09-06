import React, { useState } from "react";
import axios from "axios";

function MergePDF() {
    const [files, setFiles] = useState([]);
    const [mergedUrl, setMergedUrl] = useState(null);
    const [criteria, setCriteria] = useState("chronology");
    const [regex, setRegex] = useState("");

    const handleFiles = (e) => {
        setFiles([...e.target.files]);
        setMergedUrl(null);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setFiles([...e.dataTransfer.files]);
        setMergedUrl(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleCriteriaChange = (e) => {
        setCriteria(e.target.value);
    };

    const handleRegexChange = (e) => {
        setRegex(e.target.value);
    };

    const handleMerge = async () => {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.append("criteria", criteria);
        if (criteria === "regex") {
            formData.append("regex", regex);
        }
        const response = await axios.post("http://localhost:8000/merge", formData, {
            responseType: "blob",
            headers: { "Content-Type": "multipart/form-data" },
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        setMergedUrl(url);
    };

    return (
        <div style={{ padding: 40 }}>
            <h2>Merge PDFs</h2>
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                style={{
                    border: "2px dashed #888",
                    padding: 40,
                    marginBottom: 20,
                    borderRadius: 10,
                    textAlign: "center",
                }}
            >
                Drag & drop PDF files here
                <br />
                <input
                    type="file"
                    multiple
                    accept="application/pdf"
                    onChange={handleFiles}
                    style={{ marginTop: 20 }}
                />
            </div>
            <div style={{ marginBottom: 20 }}>
                <label>
                    Merge Criteria:&nbsp;
                    <select value={criteria} onChange={handleCriteriaChange}>
                        <option value="chronology">Chronology (upload order)</option>
                        <option value="name">Name (alphabetical)</option>
                        <option value="regex">Regex (extract from name)</option>
                    </select>
                </label>
                {criteria === "regex" && (
                    <div style={{ marginTop: 10 }}>
                        <input
                            type="text"
                            placeholder="Enter regex (e.g. (\d+))"
                            value={regex}
                            onChange={handleRegexChange}
                            style={{ width: 250 }}
                        />
                    </div>
                )}
            </div>
            <button onClick={handleMerge} disabled={files.length === 0 || (criteria === "regex" && !regex)}>
                Merge PDFs
            </button>
            {mergedUrl && (
                <div style={{ marginTop: 20 }}>
                    <a href={mergedUrl} download="merged.pdf">
                        Download merged PDF
                    </a>
                </div>
            )}
        </div>
    );
}

export default MergePDF;