import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const ACCEPTED_FILE_TYPES = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/msword",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const ACCEPTED_FILE_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx", ".ppt", ".pptx"];
const ACCEPT_ATTRIBUTE = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/msword",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
].join(",");

function isSupportedFile(file) {
    const fileName = file.name.toLowerCase();
    return ACCEPTED_FILE_TYPES.has(file.type) ||
        ACCEPTED_FILE_EXTENSIONS.some((extension) => fileName.endsWith(extension));
}

function MergePDF() {
    const [files, setFiles] = useState([]);          // Array<File>
    const [mergedUrl, setMergedUrl] = useState(null);
    const [criteria, setCriteria] = useState("chronology"); // chronology | name | regex | custom
    const [regex, setRegex] = useState("");
    const [finalFileName, setFinalFileName] = useState('merged.pdf'); // Default file name
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const dragFromIndex = useRef(null);

    useEffect(() => {
        return () => {
            if (mergedUrl) URL.revokeObjectURL(mergedUrl);
        };
    }, [mergedUrl]);

    const updateFiles = (fileList) => {
        const selected = Array.from(fileList || []);
        const supported = selected.filter(isSupportedFile);
        const rejectedCount = selected.length - supported.length;

        setFiles(supported);
        setError(rejectedCount > 0
            ? `${rejectedCount} unsupported file${rejectedCount === 1 ? "" : "s"} ignored. Use PDF, PNG, JPG, JPEG, DOC, DOCX, PPT, or PPTX files.`
            : ""
        );
        if (mergedUrl) {
            URL.revokeObjectURL(mergedUrl);
            setMergedUrl(null);
        }
    };

    const handleFiles = (e) => {
        updateFiles(e.target.files);
    };

    const handleDropZoneDrop = (e) => {
        e.preventDefault();
        updateFiles(e.dataTransfer.files);
    };

    const handleDropZoneDragOver = (e) => e.preventDefault();

    const handleCriteriaChange = (e) => {
        setCriteria(e.target.value);
        setError("");
    };
    const handleRegexChange = (e) => {
        setRegex(e.target.value);
        setError("");
    };

    // --- Reordering logic (native DnD on the list) ---
    const onItemDragStart = (index) => (e) => {
        dragFromIndex.current = index;
        e.dataTransfer.effectAllowed = "move";
        // Needed for Firefox
        e.dataTransfer.setData("text/plain", String(index));
    };

    const onItemDragOver = (index) => (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const onItemDrop = (index) => (e) => {
        e.preventDefault();
        const from = dragFromIndex.current ?? Number(e.dataTransfer.getData("text/plain"));
        const to = index;
        if (from === to || from == null || to == null) return;

        setFiles((prev) => {
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return next;
        });
        dragFromIndex.current = null;
    };

    const removeAt = (index) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
        setError("");
    };

    const handleMerge = async () => {
        const formData = new FormData();

        // If "custom", we still send "chronology" to backend and rely on our append order
        const serverCriteria = criteria === "custom" ? "chronology" : criteria;

        files.forEach((file) => formData.append("files", file));
        formData.append("criteria", serverCriteria);
        if (serverCriteria === "regex") {
            formData.append("regex", regex);
        }

        try {
            setLoading(true);
            setError("");

            const response = await axios.post("http://localhost:8000/merge", formData, {
                responseType: "blob",
                headers: { "Content-Type": "multipart/form-data" },
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            if (mergedUrl) URL.revokeObjectURL(mergedUrl);
            setMergedUrl(url);
        } catch (err) {
            console.error(err);
            let detail = "";
            const responseData = err.response?.data;

            if (responseData instanceof Blob) {
                const text = await responseData.text();
                try {
                    detail = JSON.parse(text).detail || text;
                } catch {
                    detail = text;
                }
            } else if (responseData?.detail) {
                detail = responseData.detail;
            }

            setError(detail || "Failed to create the PDF. Please check the selected files and try again.");
        } finally {
            setLoading(false);
        }
    };

    const disableMerge =
        loading || files.length === 0 || (criteria === "regex" && !regex.trim());

    return (
        <div style={{ padding: 40, maxWidth: 720, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
            <h2 style={{ marginTop: 0 }}>Merge Files to PDF</h2>

            {/* Drop zone */}
            <div
                onDrop={handleDropZoneDrop}
                onDragOver={handleDropZoneDragOver}
                style={{
                    border: "2px dashed #888",
                    padding: 24,
                    marginBottom: 20,
                    borderRadius: 10,
                    textAlign: "center",
                    background: "#fafafa",
                }}
            >
                Drag & drop PDF, PNG, JPG, JPEG, DOC, DOCX, PPT, or PPTX files here
                <br />
                <input
                    type="file"
                    multiple
                    accept={ACCEPT_ATTRIBUTE}
                    onChange={handleFiles}
                    style={{ marginTop: 16 }}
                />
            </div>

            {/* Criteria */}
            <div style={{ marginBottom: 16 }}>
                <label>
                    Merge Criteria:&nbsp;
                    <select value={criteria} onChange={handleCriteriaChange}>
                        <option value="chronology">Upload order (as listed)</option>
                        <option value="name">Name (alphabetical)</option>
                        <option value="number">Number inside filename</option>
                        <option value="date">Date inside filename (YYYY-MM-DD)</option>
                        <option value="regex">Advanced (custom regex)</option>
                        <option value="custom">Custom (drag to reorder)</option>
                    </select>
                </label>
            </div>

            {criteria === "regex" && (
                <div style={{ marginTop: 10 }}>
                    <small style={{ display: "block", marginBottom: 4 }}>
                        Advanced: Extract part of the filename using regex
                    </small>
                    <input
                        type="text"
                        placeholder="e.g. (\d+)"
                        value={regex}
                        onChange={handleRegexChange}
                        style={{ width: 260 }}
                    />
                </div>
            )}

            {/* Order frame */}
            {files.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 8, fontWeight: 600 }}>
                        {criteria === "custom" ? "Drag to reorder:" : "Current order:"}
                    </div>
                    <ol
                        style={{
                            listStyle: "decimal",
                            padding: 0,
                            margin: 0,
                            display: "grid",
                            gap: 8,
                        }}
                    >
                        {files.map((f, i) => (
                            <li
                                key={`${f.name}-${i}`}
                                draggable={criteria === "custom"}
                                onDragStart={onItemDragStart(i)}
                                onDragOver={onItemDragOver(i)}
                                onDrop={onItemDrop(i)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    padding: "10px 12px",
                                    border: "1px solid #ddd",
                                    borderRadius: 8,
                                    background: "#fff",
                                    cursor: criteria === "custom" ? "grab" : "default",
                                    userSelect: "none",
                                }}
                                title={criteria === "custom" ? "Drag to move" : undefined}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                    <span
                                        aria-hidden
                                        style={{
                                            display: "inline-block",
                                            width: 16,
                                            opacity: criteria === "custom" ? 1 : 0.4,
                                        }}
                                    >
                                        ≡
                                    </span>
                                    <span
                                        style={{
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            maxWidth: 520,
                                        }}
                                    >
                                        {f.name}
                                    </span>
                                    <span style={{ color: "#666", fontSize: 12 }}>({i + 1})</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeAt(i)}
                                    style={{
                                        border: "1px solid #ddd",
                                        background: "#f8f8f8",
                                        borderRadius: 6,
                                        padding: "4px 8px",
                                        cursor: "pointer",
                                        color: "#900",
                                    }}
                                >
                                    Remove
                                </button>
                            </li>
                        ))}
                    </ol>
                </div>
            )}

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

            <button onClick={handleMerge} disabled={disableMerge} style={{ padding: "10px 16px", borderRadius: 8 }}>
                {loading ? "Creating..." : "Create PDF"}
            </button>

            {error && (
                <div style={{ marginTop: 12, color: "#b00020" }}>
                    {error}
                </div>
            )}

            {mergedUrl && (
                <div style={{ marginTop: 16 }}>
                    <a href={mergedUrl} download={finalFileName}>
                        Download PDF
                    </a>
                </div>
            )}
        </div>
    );
}

export default MergePDF;
