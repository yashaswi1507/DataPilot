import { useState } from "react";
import { AlertTriangle, Sliders, Play, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from "recharts";
import useStore from "../store/useStore";
import { detectAnomalies } from "../api/client";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export default function Advanced() {
  const store      = useStore();
  const navigate   = useNavigate();
  const activeData = store.getActiveData();
  const [tab,      setTab]       = useState("anomaly");
  const [method,   setMethod]    = useState("iqr");
  const [threshold,setThreshold] = useState(2.5);
  const [anomalies,setAnomalies] = useState(store.anomalyResult);
  const [loading,  setLoading]   = useState(false);
  const [wiTarget, setWiTarget]  = useState("");
  const [wiInputs, setWiInputs]  = useState({});
  const [wiResult, setWiResult]  = useState(null);

  if (!activeData) return (
    <div className="page" style={{ textAlign:"center", paddingTop:80 }}>
      <p style={{ color:"#9CA3AF" }}>Upload a dataset first.</p>
      <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => navigate("/")}>Go to Dashboard</button>
    </div>
  );

  const numCols = activeData.columns.filter((c,i) =>
    activeData.data.slice(0,5).some(row => typeof row[i] === "number")
  );

  const handleDetect = async () => {
    setLoading(true);
    try {
      const res = await detectAnomalies(activeData.columns, activeData.data, method, threshold);
      store.setAnomalyResult(res); setAnomalies(res);
      store.addActivity(`Anomaly detection: ${res.total} found`);
      res.total === 0 ? toast.success("No anomalies detected!") : toast.success(`Found ${res.total} anomalies in ${res.columns_affected} columns`);
    } catch (e) { toast.error("Detection failed: " + e.message); }
    finally { setLoading(false); }
  };

  const handleWhatIf = () => {
    if (!wiTarget) return toast.error("Select outcome column");
    const tIdx    = activeData.columns.indexOf(wiTarget);
    const tVals   = activeData.data.map(r => r[tIdx]).filter(v => v !== null && !isNaN(v));
    const tMean   = tVals.reduce((a,b) => a+b,0) / tVals.length;
    const inputKeys = Object.keys(wiInputs);
    if (!inputKeys.length) return toast.error("Adjust at least one slider");

    let adjustment = 0;
    inputKeys.forEach(k => {
      const idx   = activeData.columns.indexOf(k);
      const vals  = activeData.data.map(r => r[idx]).filter(v => v !== null && !isNaN(v));
      const mean  = vals.reduce((a,b) => a+b,0) / vals.length;
      const diff  = Number(wiInputs[k]) - mean;
      if (mean !== 0) adjustment += (diff/Math.abs(mean)) * tMean * 0.12;
    });

    const predicted = tMean + adjustment;
    setWiResult({ predicted:predicted.toFixed(2), mean:tMean.toFixed(2), delta:(predicted-tMean).toFixed(2) });
    toast.success("What-If analysis done!");
  };

  const tabStyle = (id) => ({
    padding:"10px 20px", fontSize:13, fontWeight:500,
    borderBottom: `2px solid ${tab===id?"#6B5FED":"transparent"}`,
    color: tab===id?"#6B5FED":"#6B7280",
    background:"none", border:"none",
    cursor:"pointer", transition:"all 0.15s",
  });

  return (
    <div className="page">

      {/* Tabs */}
      <div style={{ borderBottom:"1px solid #E5E7EB", marginBottom:20, display:"flex", gap:0 }}>
        <button style={tabStyle("anomaly")} onClick={() => setTab("anomaly")}>🚨 Anomaly Detection</button>
        <button style={tabStyle("whatif")}  onClick={() => setTab("whatif")}>🎯 What-If Analysis</button>
      </div>

      {/* Anomaly Detection */}
      {tab === "anomaly" && (
        <>
          <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:20, marginBottom:20 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:14, alignItems:"end" }}>
              <div>
                <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>Detection Method</label>
                <select value={method} onChange={e => setMethod(e.target.value)} style={{ width:"100%" }}>
                  <option value="iqr">IQR (Interquartile Range)</option>
                  <option value="zscore">Z-Score</option>
                  <option value="both">Both Methods</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>Z-Score Threshold: <strong>{threshold}</strong></label>
                <input type="range" min={1.5} max={4} step={0.5} value={threshold}
                  onChange={e => setThreshold(Number(e.target.value))} style={{ width:"100%", marginTop:6 }} />
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#9CA3AF" }}>
                  <span>1.5 (Strict)</span><span>4.0 (Lenient)</span>
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleDetect} disabled={loading}>
                <AlertTriangle size={14} /> {loading?"Scanning...":"Detect Anomalies"}
              </button>
            </div>
          </div>

          {anomalies && (
            <>
              {anomalies.total === 0 ? (
                <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:10, padding:24, textAlign:"center" }}>
                  <p style={{ fontSize:24, marginBottom:8 }}>✅</p>
                  <p style={{ fontSize:15, fontWeight:600, color:"#15803D" }}>No anomalies detected!</p>
                  <p style={{ fontSize:13, color:"#16A34A" }}>Your dataset looks clean.</p>
                </div>
              ) : (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
                    <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10, padding:"16px 20px" }}>
                      <p style={{ fontSize:12, color:"#DC2626", margin:"0 0 4px" }}>Total Anomalies Found</p>
                      <p style={{ fontSize:32, fontWeight:700, color:"#EF4444", margin:0 }}>{anomalies.total}</p>
                    </div>
                    <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:10, padding:"16px 20px" }}>
                      <p style={{ fontSize:12, color:"#D97706", margin:"0 0 4px" }}>Columns Affected</p>
                      <p style={{ fontSize:32, fontWeight:700, color:"#F59E0B", margin:0 }}>{anomalies.columns_affected}</p>
                    </div>
                  </div>

                  {Object.entries(anomalies.anomalies || {}).map(([col, info]) => {
                    const colIdx = activeData.columns.indexOf(col);
                    const chartData = activeData.data.slice(0,150).map((row, i) => ({
                      index:i, value:row[colIdx], isAnomaly: info.indices?.includes(i)
                    }));
                    return (
                      <div key={col} style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:20, marginBottom:14 }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                          <h3 style={{ fontSize:14, fontWeight:700, margin:0 }}>{col}</h3>
                          <span className="badge badge-danger">{info.count} anomalies</span>
                        </div>
                        <ResponsiveContainer width="100%" height={180}>
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                            <XAxis dataKey="index" tick={{ fontSize:10 }} />
                            <YAxis tick={{ fontSize:10 }} />
                            <Tooltip formatter={(v) => [v?.toFixed?.(2)??v, col]} />
                            <Line type="monotone" dataKey="value" stroke="#6B5FED" strokeWidth={1.5} dot={false} />
                            {info.indices?.slice(0,15).map(idx => {
                              const row = activeData.data[idx];
                              const val = row?.[colIdx];
                              if (val === null || val === undefined) return null;
                              return <ReferenceDot key={idx} x={idx} y={val} r={5} fill="#EF4444" stroke="white" strokeWidth={1.5} />;
                            })}
                          </LineChart>
                        </ResponsiveContainer>
                        {info.explanations?.slice(0,3).map((e,i) => (
                          <div key={i} style={{ fontSize:12, color:"#6B7280", background:"#F9FAFB", borderRadius:6, padding:"6px 10px", marginTop:6 }}>
                            Row {e.row}: {e.explanation}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}

          {!anomalies && (
            <div style={{ textAlign:"center", paddingTop:60, color:"#9CA3AF" }}>
              <p style={{ fontSize:40, marginBottom:12 }}>🔍</p>
              <p style={{ fontSize:14 }}>Click "Detect Anomalies" to scan your dataset.</p>
            </div>
          )}
        </>
      )}

      {/* What-If Analysis */}
      {tab === "whatif" && (
        <>
          <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:20, marginBottom:20 }}>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:6 }}>Select Outcome Column (what you want to predict)</label>
              <select value={wiTarget} onChange={e => { setWiTarget(e.target.value); setWiResult(null); setWiInputs({}); }} style={{ width:280 }}>
                <option value="">Select outcome column...</option>
                {numCols.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {wiTarget && (
              <>
                <p style={{ fontSize:13, fontWeight:600, color:"#374151", marginBottom:12 }}>
                  Adjust inputs — see how <strong style={{ color:"#6B5FED" }}>{wiTarget}</strong> changes:
                </p>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:16 }}>
                  {numCols.filter(c => c !== wiTarget).slice(0,6).map(col => {
                    const idx  = activeData.columns.indexOf(col);
                    const vals = activeData.data.map(r => r[idx]).filter(v => v !== null && !isNaN(v));
                    const min  = Math.min(...vals);
                    const max  = Math.max(...vals);
                    const mean = vals.reduce((a,b) => a+b,0) / vals.length;
                    const cur  = wiInputs[col] !== undefined ? wiInputs[col] : mean;
                    const step = Math.max((max-min)/100, 0.01);
                    return (
                      <div key={col}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <label style={{ fontSize:12, color:"#6B7280" }}>{col}</label>
                          <span style={{ fontSize:12, fontWeight:600, color:"#6B5FED" }}>{Number(cur).toFixed(2)}</span>
                        </div>
                        <input type="range" min={min} max={max} step={step} value={cur}
                          onChange={e => setWiInputs(p => ({ ...p, [col]: Number(e.target.value) }))}
                          style={{ width:"100%" }} />
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#9CA3AF" }}>
                          <span>{min.toFixed(1)}</span><span>{max.toFixed(1)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button className="btn btn-primary" onClick={handleWhatIf}>
                  <Sliders size={14} /> Calculate What-If
                </button>
              </>
            )}
          </div>

          {wiResult && (
            <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:20 }}>
              <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>What-If Result for <span style={{ color:"#6B5FED" }}>{wiTarget}</span></h3>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
                <div style={{ background:"#F5F3FF", border:"1px solid #DDD6FE", borderRadius:10, padding:16, textAlign:"center" }}>
                  <p style={{ fontSize:12, color:"#7C3AED", margin:"0 0 6px" }}>Predicted Value</p>
                  <p style={{ fontSize:28, fontWeight:700, color:"#6B5FED", margin:0 }}>{wiResult.predicted}</p>
                </div>
                <div style={{ background:"#F9FAFB", border:"1px solid #E5E7EB", borderRadius:10, padding:16, textAlign:"center" }}>
                  <p style={{ fontSize:12, color:"#6B7280", margin:"0 0 6px" }}>Dataset Average</p>
                  <p style={{ fontSize:28, fontWeight:700, color:"#374151", margin:0 }}>{wiResult.mean}</p>
                </div>
                <div style={{
                  background: Number(wiResult.delta)>=0?"#F0FDF4":"#FEF2F2",
                  border: `1px solid ${Number(wiResult.delta)>=0?"#BBF7D0":"#FECACA"}`,
                  borderRadius:10, padding:16, textAlign:"center"
                }}>
                  <p style={{ fontSize:12, color: Number(wiResult.delta)>=0?"#15803D":"#DC2626", margin:"0 0 6px" }}>Change from Average</p>
                  <p style={{ fontSize:28, fontWeight:700, color: Number(wiResult.delta)>=0?"#22C55E":"#EF4444", margin:0 }}>
                    {Number(wiResult.delta)>=0?"+":""}{wiResult.delta}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!wiTarget && (
            <div style={{ textAlign:"center", paddingTop:60, color:"#9CA3AF" }}>
              <p style={{ fontSize:40, marginBottom:12 }}>🎯</p>
              <p style={{ fontSize:14 }}>Select an outcome column to start What-If analysis.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
