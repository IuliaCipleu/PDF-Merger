import React, { useState } from "react";
import "./App.css";
import Menu from "./components/Menu";
import MergePDF from "./components/MergePDF";
import SplitPDF from "./components/SplitPDF";
import CompressPDF from "./components/CompressPDF";
import DeletePDF from "./components/DeletePDF";

function App() {
  const [selected, setSelected] = useState("merge");

  return (
    <div className="app-container">
      <h1>PDF Merger Suite</h1>
      <Menu selected={selected} onSelect={setSelected} />
      <div className="card">
        {selected === "merge" && <MergePDF />}
        {selected === "split" && <SplitPDF />}
        {selected === "compress" && <CompressPDF />}
        {selected === "delete" && <DeletePDF />}
      </div>
    </div>
  );
}

export default App;