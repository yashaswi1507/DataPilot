import { useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import useStore from "../store/useStore";
import { cleanDataset } from "../api/client";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export default function Duplicates() {
  const store    = useStore();
  const navigate = useNavigate();
  const raw      = store.rawData;
  const [running, setRunning] = useState(false);
  const [dupRows, setDupRows] = useState(null);

  if (!raw) return (
    <div className="page" style={{ textAlign:"center", paddingTop:80 }}>
      <p style={{ color:"#9CA3AF" }}>Upload a dataset first.</p>
      <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => navigate("/")}>Go to Dashboard</button>
    </div>
  );

  // Detect duplicate rows client-side for preview
  const findDuplicates = () => {
    const seen = new Map();
    const dupIndices = [];
    raw.data.forEach((row, i) => {
      const key = JSON.stringify(row);
      if (seen.has(key)) dupIndices.push(i);
      else seen.set(key, i);
    });
    setDupRows(dupIndices);
  };

  const handleRemove = async () => {
    setRunning(true);
    try {
      const res = await cleanDataset(raw.columns, raw.data, "No Action", "Auto");
      store.setCleanData(res.clean); store.setCleanReport(res.report || []);
      store.addActivity("Duplicate rows removed");
      toast.success("Duplicates removed!");
      setDupRows(null);
    } catch (e) { toast.error("Failed: " + e.message); }
    finally { setRunning(false); }
  };

  return (
    <div className="page">
      <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:20, marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h2 style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>Duplicate Detection</h2>
            <p style={{ fontSize:13, color:"#6B7280" }}>Scan for exact duplicate rows in your dataset.</p>
          </div>
          <button className="btn btn-secondary" onClick={findDuplicates}>
            <Copy size={14} /> Scan for Duplicates
          </button>
        </div>
      </div>

      {dupRows !== null && (
        <>
          {dupRows.length === 0 ? (
            <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:10, padding:24, textAlign:"center" }}>
              <p style={{ fontSize:24, marginBottom:8 }}>✅</p>
              <p style={{ fontSize:15, fontWeight:600, color:"#15803D" }}>No duplicate rows found!</p>
            </div>
          ) : (
            <>
              <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10, padding:"16px 20px", marginBottom:16, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <p style={{ fontSize:12, color:"#DC2626", margin:"0 0 4px" }}>Duplicate Rows Found</p>
                  <p style={{ fontSize:28, fontWeight:700, color:"#EF4444", margin:0 }}>{dupRows.length}</p>
                </div>
                <button className="btn btn-primary" onClick={handleRemove} disabled={running}>
                  <Trash2 size={14} /> {running ? "Removing..." : "Remove All Duplicates"}
                </button>
              </div>

              <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:20 }}>
                <h3 style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>Duplicate Row Preview</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Row #</th>
                      {raw.columns.slice(0,6).map(c => <th key={c}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {dupRows.slice(0,10).map(idx => (
                      <tr key={idx}>
                        <td style={{ color:"#EF4444", fontWeight:600 }}>{idx+1}</td>
                        {raw.data[idx].slice(0,6).map((cell,j) => (
                          <td key={j}>{cell === null ? <span style={{ color:"#D1D5DB" }}>null</span> : String(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {dupRows.length > 10 && <p style={{ fontSize:12, color:"#9CA3AF", textAlign:"center", marginTop:10 }}>Showing 10 of {dupRows.length} duplicate rows</p>}
              </div>
            </>
          )}
        </>
      )}

      {dupRows === null && (
        <div style={{ textAlign:"center", paddingTop:60, color:"#9CA3AF" }}>
          <p style={{ fontSize:40, marginBottom:12 }}>🔍</p>
          <p style={{ fontSize:14 }}>Click "Scan for Duplicates" to check your dataset.</p>
        </div>
      )}
    </div>
  );
}
