import { useState } from "react";

/**
 * Reusable column-selection UI for visualization pages (Charts, Analytics).
 * Shows a banner prompting the user to pick columns on first visit, and a
 * modal checklist to select/deselect. Returns the working dataset (full or
 * filtered) via the `workingData` value — cleaning/upload always use the
 * full dataset; this only narrows what's used for chart generation.
 *
 * Usage:
 *   const { workingData, picker } = useColumnSelection(activeData);
 *   // render {picker} somewhere in your JSX, use workingData instead of activeData
 */
export function useColumnSelection(activeData) {
  const [selectedCols, setSelectedCols] = useState(null);
  const [showPicker,   setShowPicker]   = useState(false);
  const [tempSelection,setTempSelection]= useState([]);

  const workingData = (() => {
    if (!activeData) return null;
    if (!selectedCols || selectedCols.length === activeData.columns.length) return activeData;
    const idxs = selectedCols.map(c => activeData.columns.indexOf(c));
    return {
      ...activeData,
      columns: selectedCols,
      data: activeData.data.map(row => idxs.map(i => row[i])),
    };
  })();

  const openPicker = () => {
    setTempSelection(selectedCols || activeData.columns);
    setShowPicker(true);
  };

  const confirmPicker = (onConfirm) => {
    if (tempSelection.length === 0) return false;
    setSelectedCols(tempSelection);
    setShowPicker(false);
    if (onConfirm) onConfirm();
    return true;
  };

  const toggleCol = (col) => {
    setTempSelection(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  return {
    workingData, selectedCols, setSelectedCols,
    showPicker, setShowPicker, tempSelection, setTempSelection,
    openPicker, confirmPicker, toggleCol,
  };
}

export function ColumnSelectionBanner({ activeData, selectedCols, setSelectedCols, openPicker }) {
  if (selectedCols === null) {
    return (
      <div style={{ background:"#EEF0FF", border:"1px solid #DDD6FE", borderRadius:10, padding:"14px 18px", marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <p style={{ fontSize:13, fontWeight:600, color:"#6B5FED", margin:"0 0 2px" }}>
            This dataset has {activeData.columns.length} columns
          </p>
          <p style={{ fontSize:12, color:"#6B7280", margin:0 }}>
            Pick which ones to work with here for faster charts, or use all columns.
          </p>
        </div>
        <div style={{ display:"flex", gap:8, flexShrink:0 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedCols(activeData.columns)}>
            Use All Columns
          </button>
          <button className="btn btn-primary btn-sm" onClick={openPicker}>
            Select Columns
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, fontSize:12, color:"#6B7280" }}>
      <span>
        Working with <strong style={{ color:"#374151" }}>{selectedCols.length} of {activeData.columns.length}</strong> columns
      </span>
      <button className="btn btn-secondary btn-sm" onClick={openPicker}>
        Change Columns
      </button>
    </div>
  );
}

export function ColumnPickerModal({ activeData, showPicker, setShowPicker, tempSelection, setTempSelection, toggleCol, confirmPicker, onConfirmed }) {
  if (!showPicker) return null;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }} onClick={() => setShowPicker(false)}>
      <div style={{ background:"white", borderRadius:12, padding:24, width:480, maxHeight:"70vh", display:"flex", flexDirection:"column" }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <h3 style={{ fontSize:15, fontWeight:700, margin:0 }}>Select columns to work with</h3>
          <button onClick={() => setShowPicker(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9CA3AF", fontSize:18 }}>×</button>
        </div>

        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setTempSelection(activeData.columns)}>Select All</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setTempSelection([])}>Select None</button>
          <span style={{ fontSize:12, color:"#9CA3AF", marginLeft:"auto", alignSelf:"center" }}>{tempSelection.length} selected</span>
        </div>

        <div style={{ overflowY:"auto", flex:1, border:"1px solid #F3F4F6", borderRadius:8, padding:8, marginBottom:16 }}>
          {activeData.columns.map(col => (
            <label key={col} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 8px", cursor:"pointer", borderRadius:6 }}
              onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <input
                type="checkbox"
                checked={tempSelection.includes(col)}
                onChange={() => toggleCol(col)}
                style={{ width:14, height:14 }}
              />
              <span style={{ fontSize:13, color:"#374151" }}>{col}</span>
            </label>
          ))}
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button className="btn btn-secondary" style={{ flex:1, justifyContent:"center" }} onClick={() => setShowPicker(false)}>Cancel</button>
          <button className="btn btn-primary" style={{ flex:1, justifyContent:"center" }} onClick={() => {
            const ok = confirmPicker(onConfirmed);
            if (!ok) {
              // signal via a quick visual cue — caller can also handle this
            }
          }}>
            Use {tempSelection.length} Column{tempSelection.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
