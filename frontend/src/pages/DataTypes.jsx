import { FileType2 } from "lucide-react";
import useStore from "../store/useStore";
import { useNavigate } from "react-router-dom";

export default function DataTypes() {
  const store    = useStore();
  const navigate = useNavigate();
  const raw      = store.rawData;
  const profiles = store.columnProfiles || {};

  if (!raw) return (
    <div className="page" style={{ textAlign:"center", paddingTop:80 }}>
      <p style={{ color:"#9CA3AF" }}>Upload a dataset first.</p>
      <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => navigate("/")}>Go to Dashboard</button>
    </div>
  );

  const typeColors = {
    numeric: "#6B5FED", category: "#22C55E", categorical: "#22C55E",
    date: "#F59E0B", text: "#EF4444", name: "#3B82F6",
    email: "#EC4899", phone: "#8B5CF6", address: "#14B8A6",
  };

  return (
    <div className="page">
      <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
          <FileType2 size={18} color="#6B5FED" />
          <h2 style={{ fontSize:15, fontWeight:700, margin:0 }}>Detected Column Types</h2>
        </div>
        <p style={{ fontSize:13, color:"#6B7280", marginBottom:18 }}>
          DataPilot automatically detects the best data type for every column based on its content — not just its name.
        </p>

        <table className="data-table">
          <thead>
            <tr><th>Column</th><th>Detected Type</th><th>Sample Values</th><th>Unique Values</th></tr>
          </thead>
          <tbody>
            {raw.columns.map((col,i) => {
              const p = profiles[col] || {};
              const samples = raw.data.slice(0,3).map(r => r[i]).filter(v => v !== null && v !== undefined);
              return (
                <tr key={col}>
                  <td style={{ fontWeight:500 }}>{col}</td>
                  <td>
                    <span className="badge" style={{ background:`${typeColors[p.detected_type]||"#9CA3AF"}15`, color:typeColors[p.detected_type]||"#6B7280" }}>
                      {p.detected_type || "unknown"}
                    </span>
                  </td>
                  <td style={{ fontSize:12, color:"#6B7280" }}>{samples.join(", ").slice(0,50)}</td>
                  <td>{p.unique_count ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
