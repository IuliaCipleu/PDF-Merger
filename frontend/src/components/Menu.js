import React from "react";
import "..//App.css";

function Menu({ onSelect, selected }) {
  const items = [
    { key: "merge", label: "Merge PDF" },
    { key: "split", label: "Split PDF" },
    { key: "compress", label: "Compress PDF" },
    { key: "delete", label: "Delete PDF" },
  ];

  return (
    <nav className="menu">
      {items.map((item) => (
        <button
          key={item.key}
          className={`menu-item${selected === item.key ? " selected" : ""}`}
          onClick={() => onSelect(item.key)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export default Menu;