import React, { useState } from 'react';

function SplitPDF({ onSplit }) {
    const [file, setFile] = useState(null);
    const [criteria, setCriteria] = useState('range');
    const [range, setRange] = useState('');
    const [everyN, setEveryN] = useState(1);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleCriteriaChange = (e) => {
        setCriteria(e.target.value);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!file) return;
        let splitOptions = {};
        if (criteria === 'range') {
            splitOptions = { type: 'range', value: range };
        } else {
            splitOptions = { type: 'every', value: everyN };
        }
        // Pass file and splitOptions to parent or API
        if (onSplit) onSplit(file, splitOptions);
    };

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
                        Split by:
                        <select value={criteria} onChange={handleCriteriaChange}>
                            <option value="range">Page Range (e.g. 1-3,5,7-9)</option>
                            <option value="every">Every N Pages</option>
                        </select>
                    </label>
                </div>
                {criteria === 'range' && (
                    <div style={{ marginTop: 8 }}>
                        <label>
                            Page ranges:
                            <input
                                type="text"
                                placeholder="e.g. 1-3,5,7-9"
                                value={range}
                                onChange={(e) => setRange(e.target.value)}
                                required
                            />
                        </label>
                    </div>
                )}
                {criteria === 'every' && (
                    <div style={{ marginTop: 8 }}>
                        <label>
                            Every
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
                    </div>
                )}
                <button type="submit" style={{ marginTop: 20 }}>Split PDF</button>
            </form>
        </div>
    );
}

export default SplitPDF;