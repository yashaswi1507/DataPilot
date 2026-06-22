import { useState } from "react";
import { Download, Filter, Search, Eye, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import useStore from "../store/useStore";
import { downloadCleanedCSV } from "../api/client";
import CommentsPanel from "../components/ui/CommentsPanel";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export default function Overview() {
  const store    = useStore();
  const navigate = useNavigate();
  const raw      = store.rawData;
  const clean    = store.cleanData;
  const profiles = store.columnProfiles || {};
  const [tab,    setTab]    = useState("clean");
  const [search, setSearch] = useState("");
  const [rows,   setRows]   = useState(20);    // rows per page
  const [page,   setPage]   = useState(1);     // current page (1-indexed)

  if (!raw) return (
    <div className="page" style={{ textAlign:"center", paddingTop:80 }}>
      <p style={{ color:"#9CA3AF" }}>Upload a dataset first.</p>
      <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => navigate("/")}>Go to Dashboard</button>
    </div>
  );

  const data     = (tab === "clean" && clean) ? clean : raw;
  const filtered = search
    ? data.data.filter(row => row.some(c => String(c??"").toLowerCase().includes(search.toLowerCase())))
    : data.data;

  const totalPages = Math.max(1, Math.ceil(filtered.length / rows));
  const safePage    = Math.min(page, totalPages);
  const startIdx    = (safePage - 1) * rows;
  const pageRows    = filtered.slice(startIdx, startIdx + rows);

  const missing  = Object.values(profiles).reduce((s,p) => s+(p.missing_count||0), 0);
  const numCols  = Object.values(profiles).filter(p => p.detected_type==="numeric").length;
  const catCols  = Object.values(profiles).filter(p => ["category","categorical"].includes(p.detected_type)).length;
  const dateCols = Object.values(profiles).filter(p => p.detected_type==="date").length;

  const handleDownload = async () => {
    try {
      const d = clean || raw;
      await downloadCleanedCSV(d.columns, d.data);
      toast.success("Downloaded!");
    } catch { toast.error("Download failed"); }
  };

  return (
    <div className="page">

      {/* Stats row */}
      <div className="rg-6col" style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:14, marginBottom:20 }}>
        {[
          { label:"Total Rows",    value:raw.shape[0].toLocaleString() },
          { label:"Total Columns", value:raw.shape[1] },
          { label:"Missing",       value:missing, color:"#EF4444" },
          { label:"Numeric",       value:numCols||10 },
          { label:"Categorical",   value:catCols||6 },
          { label:"Date Columns",  value:dateCols||2 },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:"14px 16px" }}>
            <p style={{ fontSize:11, color:"#9CA3AF", margin:"0 0 4px" }}>{label}</p>
            <p style={{ fontSize:22, fontWeight:700, color:color||"#111827", margin:0 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Column Profiles */}
      {Object.keys(profiles).length > 0 && (
        <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:20, marginBottom:20 }}>
          <h2 style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>Column Profiles</h2>
          <div style={{ overflowX:"auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>Column</th><th>Type</th><th>Missing</th><th>Missing %</th><th>Unique</th><th>Strategy</th></tr>
              </thead>
              <tbody>
                {Object.entries(profiles).map(([col, p]) => (
                  <tr key={col}>
                    <td style={{ fontWeight:500 }}>{col}</td>
                    <td><span className="badge badge-purple">{p.detected_type}</span></td>
                    <td style={{ color: p.missing_count>0?"#EF4444":"#22C55E" }}>{p.missing_count||0}</td>
                    <td style={{ color: p.missing_count>0?"#EF4444":"#22C55E" }}>{p.missing_percent?.toFixed(1)||0}%</td>
                    <td>{p.unique_count}</td>
                    <td style={{ fontSize:12, color:"#6B7280" }}>{p.cleaning_strategy||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Data Preview */}
      <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:20 }}>
        <div className="rg-controls" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, flexWrap:"wrap", gap:10 }}>
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={() => { setTab("clean"); setPage(1); }} className="btn btn-sm" style={{ background: tab==="clean"?"#6B5FED":"white", color: tab==="clean"?"white":"#374151", border:"1px solid #E5E7EB" }}>
              Cleaned Data
            </button>
            {raw && <button onClick={() => { setTab("raw"); setPage(1); }} className="btn btn-sm" style={{ background: tab==="raw"?"#374151":"white", color: tab==="raw"?"white":"#374151", border:"1px solid #E5E7EB" }}>
              Raw Data
            </button>}
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <div style={{ position:"relative" }}>
              <Search size={13} style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search..." style={{ paddingLeft:28, paddingRight:12, width:180, fontSize:13, padding:"7px 12px 7px 28px", border:"1px solid #E5E7EB", borderRadius:8, outline:"none" }} />
            </div>
            <select value={rows} onChange={e => { setRows(Number(e.target.value)); setPage(1); }} style={{ fontSize:12, padding:"6px 10px", border:"1px solid #E5E7EB", borderRadius:8 }}>
              <option value={10}>10 rows/page</option>
              <option value={20}>20 rows/page</option>
              <option value={50}>50 rows/page</option>
              <option value={100}>100 rows/page</option>
              <option value={500}>500 rows/page</option>
            </select>
            <button className="btn btn-secondary btn-sm"><Filter size={13} /> Filter</button>
            <button className="btn btn-primary btn-sm" onClick={handleDownload}><Download size={13} /> Download Cleaned Data</button>
          </div>
        </div>

        {search && <p style={{ fontSize:12, color:"#9CA3AF", marginBottom:8 }}>Found {filtered.length} matching rows</p>}

        <div style={{ overflowX:"auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                {data.columns.map(c => <th key={c}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => (
                <tr key={startIdx + i}>
                  <td style={{ color:"#D1D5DB", fontSize:11 }}>{startIdx + i + 1}</td>
                  {row.map((cell, j) => (
                    <td key={j} style={{ maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {cell === null || cell === undefined
                        ? <span style={{ color:"#D1D5DB", fontStyle:"italic", fontSize:11 }}>null</span>
                        : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:14 }}>
          <p style={{ fontSize:12, color:"#9CA3AF", margin:0 }}>
            Showing {(startIdx + 1).toLocaleString()}–{Math.min(startIdx + rows, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()} rows
          </p>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              style={{ opacity: safePage <= 1 ? 0.4 : 1 }}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span style={{ fontSize:12, color:"#374151", padding:"0 8px" }}>
              Page {safePage} of {totalPages.toLocaleString()}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              style={{ opacity: safePage >= totalPages ? 0.4 : 1 }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
        <CommentsPanel targetType="dataset" targetRef={raw.filename || "dataset"} />
      </div>
    </div>
  );
}
