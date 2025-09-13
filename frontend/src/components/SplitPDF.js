import React, { useState } from 'react';
import axios from 'axios';

function SplitPDF() {
    const [file, setFile] = useState(null);
    const [criteria, setCriteria] = useState('range');
    const [range, setRange] = useState('');
    const [everyN, setEveryN] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = (e) => {
        setFile(e.target.files?.[0] ?? null);
        setError('');
    };

    const handleCriteriaChange = (e) => {
        setCriteria(e.target.value);
        setError('');
    };

    const triggerDownload = (blob, filename) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'split.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!file) return;

        try {
            setLoading(true);

            if (criteria === 'range') {
                // Call your existing /split endpoint which expects: file + pages (e.g. "1-3,5,7-9")
                const fd = new FormData();
                fd.append('file', file);
                fd.append('pages', range.trim());

                const resp = await axios.post('http://localhost:8000/split', fd, {
                    responseType: 'blob',
                    headers: { 'Content-Type': 'multipart/form-data' },
                    // You can add timeout if desired
                });

                // FastAPI returns application/pdf (StreamingResponse) on success or JSON error on failure
                const contentType = resp.headers['content-type'] || '';
                if (contentType.includes('application/pdf')) {
                    triggerDownload(resp.data, 'split.pdf');
                } else {
                    // Try to parse error JSON
                    const text = await resp.data.text?.();
                    setError(text || 'Server returned an unexpected response.');
                }
            } else {
                // "Every N pages" needs backend support (returns a ZIP with many PDFs).
                setError('“Every N pages” requires a server endpoint that returns a ZIP. See Option B below.');
            }
        } catch (err) {
            console.error(err);
            setError('Failed to split the PDF. Please check the server is running and the range is valid.');
        } finally {
            setLoading(false);
        }
    };

    const disableSubmit =
        !file ||
        (criteria === 'range' && !range.trim()) ||
        (criteria === 'every' && (!everyN || everyN < 1));

    return (
        <div style={{ maxWidth: 500, margin: '0 auto', padding: 24 }}>
            <h2>Split PDF</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>
                        Select PDF file:
                        <input type="file" accept="application/pdf" onChange={handleFileChange} required />
                    </label>
                </div>

                <div style={{ marginTop: 16 }}>
                    <label>
                        Split by:&nbsp;
                        <select value={criteria} onChange={handleCriteriaChange}>
                            <option value="range">Page Range (e.g. 1-3,5,7-9)</option>
                            <option value="every">Every N Pages</option>
                        </select>
                    </label>
                </div>

                {criteria === 'range' && (
                    <div style={{ marginTop: 8 }}>
                        <label>
                            Page ranges:&nbsp;
                            <input
                                type="text"
                                placeholder="e.g. 1-3,5,7-9"
                                value={range}
                                onChange={(e) => setRange(e.target.value)}
                                required
                                style={{ width: '100%' }}
                            />
                        </label>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                            Tips: Use commas to separate; ranges like 3-6 are allowed; spaces are ignored.
                        </div>
                    </div>
                )}

                {criteria === 'every' && (
                    <div style={{ marginTop: 8 }}>
                        <label>
                            Every&nbsp;
                            <input
                                type="number"
                                min="1"
                                value={everyN}
                                onChange={(e) => setEveryN(Number(e.target.value))}
                                required
                                style={{ width: 60, margin: '0 8px' }}
                            />
                            pages
                        </label>
                        <div style={{ fontSize: 12, color: '#aa6600', marginTop: 4 }}>
                            This mode needs a backend endpoint that returns a ZIP with multiple PDFs (see Option B).
                        </div>
                    </div>
                )}

                <button type="submit" style={{ marginTop: 20 }} disabled={disableSubmit || loading}>
                    {loading ? 'Splitting…' : 'Split PDF'}
                </button>

                {error && (
                    <div style={{ marginTop: 12, color: '#b00020' }}>
                        {error}
                    </div>
                )}
            </form>
        </div>
    );
}

export default SplitPDF;
