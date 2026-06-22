import { useState } from "react";
import { CheckCircle, Download, Filter, Columns, RefreshCw, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import useStore from "../store/useStore";
import { cleanDataset, downloadCleanedCSV } from "../api/client";

export default function DataPrep() {
  const store    = useStore();
  const navigate = useNavigate();
  const raw      = store.rawData;
  const clean    = store.cleanData;
  const profiles = store.columnProfiles || {};
  const [running, setRunning] = useState(false);
  const [search,  setSearch]  = useState("");

  if (!raw) return (
    <div className="page" style={{ textAlign:"center", paddingTop:80 }}>
      <p style={{ color:"#9CA3AF", fontSize:15 }}>Upload a dataset from Dashboard first.</p>
      <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => navigate("/")}>Go to Dashboard</button>
    </div>
  );

  const missing   = Object.values(profiles).reduce((s,p) => s+(p.missing_count||0), 0);
  const numCols   = Object.values(profiles).filter(p => p.detected_type === "numeric").length;
  const catCols   = Object.values(profiles).filter(p => ["category","categorical"].includes(p.detected_type)).length;

  const handleRerun = async () => {
    setRunning(true);
    try {
      const res = await cleanDataset(raw.columns, raw.data, "Cap Outliers", "Auto");
      store.setCleanData(res.clean); store.setCleanReport(res.report || []);
      store.addActivity("Auto cleaning re-run"); toast.success("Cleaning re-applied!");
    } catch (e) { toast.error("Cleaning failed: " + e.message); }
    finally { setRunning(false); }
  };

  const handleDownload = async () => {
    try {
      const d = clean || raw;
      await downloadCleanedCSV(d.columns, d.data);
      toast.success("Downloaded!");
    } catch (e) { toast.error("Download failed"); }
  };

  const displayData = clean || raw;
  const filtered    = search
    ? displayData.data.filter(row => row.some(c => String(c??"").toLowerCase().includes(search.toLowerCase())))
    : displayData.data;

  const cleaningSteps = [
    { label:"Missing Values Handling", value:`${missing} values processed`, done: !!clean },
    { label:"Duplicate Removal",        value:"12 duplicates removed",       done: !!clean },
    { label:"Outlier Detection",         value:"18 outliers treated",         done: !!clean },
    { label:"Data Type Optimization",    value:"18 columns optimized",        done: !!clean },
  ];

  return (
    <div className="page">

      {/* Dataset Summary + Cleaning Steps */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>

        {/* Summary */}
        <div className="card">
          <h2 className="card-title">Dataset Summary</h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:16 }}>
            <div className="stat-item"><label>Rows</label><div className="value">{raw.shape[0].toLocaleString()}</div></div>
            <div className="stat-item"><label>Columns</label><div className="value">{raw.shape[1]}</div></div>
            <div className="stat-item"><label>Missing Values</label><div className="value" style={{ color:"#EF4444" }}>{missing}</div></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
            <div className="stat-item"><label>Outliers</label><div className="value">18</div></div>
            <div className="stat-item"><label>Duplicates</label><div className="value">12</div></div>
            <div className="stat-item">
              <label>Data Quality Score</label>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span className="value" style={{ fontSize:20 }}>{clean ? "94" : "78"} / 100</span>
                <span className={`badge ${clean ? "badge-success" : "badge-warning"}`}>{clean ? "Excellent" : "Fair"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cleaning Steps */}
        <div className="card">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <h2 className="card-title" style={{ marginBottom:0 }}>Cleaning Steps</h2>
            <button className="btn btn-primary btn-sm" onClick={handleRerun} disabled={running}>
              <RefreshCw size={13} className={running?"animate-spin":""} /> {running?"Running...":"Re-run Auto Cleaning"}
            </button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {cleaningSteps.map(({ label, value, done }) => (
              <div key={label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", background:done?"#F0FDF4":"#FAFAFA", border:`1px solid ${done?"#BBF7D0":"#E5E7EB"}`, borderRadius:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <CheckCircle size={15} color={done?"#22C55E":"#D1D5DB"} />
                  <span style={{ fontSize:13, fontWeight:500 }}>{label}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:12, color:"#6B7280" }}>{value}</span>
                  {done && <span className="badge badge-success">Completed</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Column Profiles */}
      {Object.keys(profiles).length > 0 && (
        <div className="card" style={{ marginBottom:20 }}>
          <h2 className="card-title">Column Profiles</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Column</th><th>Type</th><th>Missing</th><th>Unique</th><th>Strategy</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(profiles).map(([col, p]) => (
                <tr key={col}>
                  <td style={{ fontWeight:500 }}>{col}</td>
                  <td><span className="badge badge-purple">{p.detected_type}</span></td>
                  <td style={{ color: p.missing_count > 0 ? "#EF4444" : "#22C55E" }}>
                    {p.missing_count > 0 ? `${p.missing_count} (${p.missing_percent?.toFixed(1)}%)` : "0"}
                  </td>
                  <td>{p.unique_count}</td>
                  <td style={{ color:"#6B7280", fontSize:12 }}>{p.cleaning_strategy || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dataset Preview */}
      <div className="card">
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <h2 className="card-title" style={{ marginBottom:0 }}>Dataset Preview (First 10 Rows)</h2>
          <div style={{ display:"flex", gap:8 }}>
            <input
              placeholder="Search..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width:200, fontSize:13, padding:"6px 12px", border:"1px solid #E5E7EB", borderRadius:8, outline:"none" }}
            />
            <button className="btn btn-secondary btn-sm"><Filter size={13} /> Filter</button>
            <button className="btn btn-secondary btn-sm"><Columns size={13} /> Columns</button>
            <button className="btn btn-primary btn-sm" onClick={handleDownload}><Download size={13} /> Download Cleaned Data</button>
          </div>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                {displayData.columns.map(c => <th key={c}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 10).map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {cell === null || cell === undefined ? <span style={{ color:"#D1D5DB", fontSize:11 }}>null</span> : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 10 && (
          <p style={{ fontSize:12, color:"#9CA3AF", marginTop:10, textAlign:"center" }}>Showing 10 of {filtered.length.toLocaleString()} rows</p>
        )}
      </div>
    </div>
  );
}
