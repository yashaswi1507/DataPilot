import { useState } from "react";
import { AlertCircle, Wand2 } from "lucide-react";
import useStore from "../store/useStore";
import { cleanDataset } from "../api/client";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export default function MissingValues() {
  const store    = useStore();
  const navigate = useNavigate();
  const raw      = store.rawData;
  const profiles = store.columnProfiles || {};
  const [strategy, setStrategy] = useState("Auto");
  const [running,  setRunning]  = useState(false);

  if (!raw) return (
    <div className="page" style={{ textAlign:"center", paddingTop:80 }}>
      <p style={{ color:"#9CA3AF" }}>Upload a dataset first.</p>
      <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => navigate("/")}>Go to Dashboard</button>
    </div>
  );

  const missingCols = Object.entries(profiles).filter(([,p]) => (p.missing_count||0) > 0);
  const totalMissing = missingCols.reduce((s,[,p]) => s + (p.missing_count||0), 0);

  const handleApply = async () => {
    setRunning(true);
    try {
      const res = await cleanDataset(raw.columns, raw.data, "Cap Outliers", strategy);
      store.setCleanData(res.clean); store.setCleanReport(res.report || []);
      store.addActivity("Missing values handled");
      toast.success("Missing values processed!");
    } catch (e) { toast.error("Failed: " + e.message); }
    finally { setRunning(false); }
  };

  return (
    <div className="page">
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
        <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:"16px 20px" }}>
          <p style={{ fontSize:12, color:"#9CA3AF", margin:"0 0 4px" }}>Total Missing Values</p>
          <p style={{ fontSize:28, fontWeight:700, color:"#EF4444", margin:0 }}>{totalMissing.toLocaleString()}</p>
        </div>
        <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:"16px 20px" }}>
          <p style={{ fontSize:12, color:"#9CA3AF", margin:"0 0 4px" }}>Columns Affected</p>
          <p style={{ fontSize:28, fontWeight:700, color:"#F59E0B", margin:0 }}>{missingCols.length}</p>
        </div>
      </div>

      <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:20, marginBottom:20 }}>
        <h2 style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>Fill Strategy</h2>
        <div style={{ display:"flex", gap:10, marginBottom:14 }}>
          {["Auto","Mean/Mode","Median","Drop Rows","Forward Fill"].map(s => (
            <button key={s} onClick={() => setStrategy(s)}
              style={{ padding:"8px 16px", borderRadius:8, fontSize:13, border:`1px solid ${strategy===s?"#6B5FED":"#E5E7EB"}`, background:strategy===s?"#EEF0FF":"white", color:strategy===s?"#6B5FED":"#374151", cursor:"pointer", fontWeight:strategy===s?600:400 }}>
              {s}
            </button>
          ))}
        </div>
        <p style={{ fontSize:12, color:"#9CA3AF", marginBottom:14 }}>
          "Auto" intelligently picks the best strategy per column based on its data type and distribution.
        </p>
        <button className="btn btn-primary" onClick={handleApply} disabled={running}>
          <Wand2 size={14} /> {running ? "Processing..." : "Apply Strategy"}
        </button>
      </div>

      {missingCols.length > 0 && (
        <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:20 }}>
          <h2 style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>Affected Columns</h2>
          <table className="data-table">
            <thead><tr><th>Column</th><th>Type</th><th>Missing Count</th><th>Missing %</th><th>Suggested Strategy</th></tr></thead>
            <tbody>
              {missingCols.map(([col,p]) => (
                <tr key={col}>
                  <td style={{ fontWeight:500 }}>{col}</td>
                  <td><span className="badge badge-purple">{p.detected_type}</span></td>
                  <td style={{ color:"#EF4444" }}>{p.missing_count}</td>
                  <td style={{ color:"#EF4444" }}>{p.missing_percent?.toFixed(1)}%</td>
                  <td style={{ fontSize:12, color:"#6B7280" }}>{p.cleaning_strategy || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {missingCols.length === 0 && (
        <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:10, padding:24, textAlign:"center" }}>
          <p style={{ fontSize:24, marginBottom:8 }}>✅</p>
          <p style={{ fontSize:15, fontWeight:600, color:"#15803D" }}>No missing values found!</p>
        </div>
      )}
    </div>
  );
}
