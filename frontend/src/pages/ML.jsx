import { useState } from "react";
import { Brain, Zap, Target, ChevronDown, ChevronUp, Save, Download, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import useStore from "../store/useStore";
import { trainModel, predictSingle, suggestTarget, saveModel, downloadModel } from "../api/client";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export default function MLPage() {
  const store      = useStore();
  const navigate   = useNavigate();
  const activeData = store.getActiveData();
  const [target,   setTarget]    = useState(store.mlTarget || "");
  const [probType, setProbType]  = useState("Regression");
  const [testSize, setTestSize]  = useState("20%");
  const [result,   setResult]    = useState(store.mlResult);
  const [inputs,   setInputs]    = useState({});
  const [prediction, setPrediction] = useState(null);
  const [showAll,     setShowAll]     = useState(false); // predict form
  const [showDetails, setShowDetails] = useState(false); // model details
  const [saving,   setSaving]    = useState(false);
  const [savedModel, setSavedModel] = useState(null);

  if (!activeData) return (
    <div className="page" style={{ textAlign:"center", paddingTop:80 }}>
      <p style={{ color:"#9CA3AF" }}>Upload a dataset first.</p>
      <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => navigate("/")}>Go to Dashboard</button>
    </div>
  );

  const numCols = activeData.columns.filter((c,i) =>
    activeData.data.slice(0,5).some(row => typeof row[i] === "number")
  );

  const handleSuggest = async () => {
    try {
      const res = await suggestTarget(activeData.columns, activeData.data);
      setTarget(res.suggested); toast.success(`Suggested: ${res.suggested}`);
    } catch { toast.error("Could not suggest"); }
  };

  const handleTrain = async () => {
    if (!target) return toast.error("Select target column");
    store.setIsTraining(true);
    try {
      const res = await trainModel(activeData.columns, activeData.data, target);
      if (!res.success) return toast.error(res.error);
      store.setMlResult(res); store.setMlTarget(target);
      setResult(res);
      store.addActivity(`Model trained: ${res.best_model_name}`);
      toast.success(`Best: ${res.best_model_name}`);
    } catch (e) { toast.error("Training failed: " + e.message); }
    finally { store.setIsTraining(false); }
  };

  const handlePredict = async () => {
    if (!result) return;
    store.setIsTraining(true);
    try {
      const res = await predictSingle(activeData.columns, activeData.data, target, inputs);
      if (!res.success) return toast.error(res.error || "Failed");
      setPrediction(res);
      store.addActivity(`Prediction made for ${target}`);
    } catch (e) { toast.error("Prediction failed: " + e.message); }
    finally { store.setIsTraining(false); }
  };

  const handleSaveModel = async () => {
    if (!result || !target) return;
    setSaving(true);
    try {
      const res = await saveModel(activeData.columns, activeData.data, target);
      setSavedModel(res);
      store.addActivity(`Model saved: ${res.model_name}`);
      toast.success(res.message || "Model saved!");
    } catch (e) {
      toast.error("Could not save model: " + (e.response?.data?.detail || e.message));
    } finally { setSaving(false); }
  };

  const handleDownloadModel = () => {
    if (!savedModel) return;
    downloadModel(savedModel.model_id);
    toast.success("Downloading model file...");
  };

  // Real test-set sample predictions from the backend (actual vs
  // predicted on held-out data) — not simulated.
  const previewRows = (result?.sample_predictions || []).map(r => ({
    actual: r.actual, predicted: r.predicted, diff: r.diff, pctErr: r.pct_error,
  }));

  return (
    <div className="page">

      {/* Controls */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:"14px 20px" }}>
        <div style={{ flex:1 }}>
          <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>Target Column</label>
          <select value={target} onChange={e => setTarget(e.target.value)} style={{ width:"100%" }}>
            <option value="">Select target column...</option>
            {activeData.columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ flex:1 }}>
          <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>Problem Type</label>
          <select value={probType} onChange={e => setProbType(e.target.value)} style={{ width:"100%" }}>
            <option>Regression</option><option>Classification</option>
          </select>
        </div>
        <div style={{ flex:1 }}>
          <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>Test Size</label>
          <select value={testSize} onChange={e => setTestSize(e.target.value)} style={{ width:"100%" }}>
            <option>20%</option><option>25%</option><option>30%</option>
          </select>
        </div>
        <button className="btn btn-primary" style={{ marginTop:20 }} onClick={handleTrain} disabled={store.isTraining || !target}>
          <Brain size={14} /> {store.isTraining ? "Training..." : "✦ Train Models"}
        </button>
      </div>

      {result && (
        <>
          {/* Model Comparison + Best Model + Feature Importance */}
          <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr 1.2fr", gap:20, marginBottom:20 }}>

            {/* Model Comparison Table */}
            <div className="card">
              <h2 className="card-title">Model Comparison</h2>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>CV Score</th>
                    {result.task_type === "regression" ? <><th>RMSE</th><th>MAE</th></> : <th>Accuracy</th>}
                    <th>Training Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.model_comparison || []).map((m, i) => (
                    <tr key={m.Model} style={{ background: i===0 ? "#FAFBFF":undefined }}>
                      <td style={{ fontWeight: i===0 ? 600 : 400 }}>{m.Model}</td>
                      <td style={{ color: i===0 ? "#6B5FED":"#111827", fontWeight: i===0 ? 600 : 400 }}>{Number(m["CV Score (mean)"]).toFixed(3)}</td>
                      {result.task_type === "regression" ? (
                        <>
                          <td>{m.RMSE !== undefined ? Number(m.RMSE).toFixed(2) : "—"}</td>
                          <td>{m.MAE !== undefined ? Number(m.MAE).toFixed(2) : "—"}</td>
                        </>
                      ) : (
                        <td>{m.Accuracy !== undefined ? `${(Number(m.Accuracy)*100).toFixed(1)}%` : "—"}</td>
                      )}
                      <td>{m["Training Time"] !== undefined && m["Training Time"] !== null ? `${m["Training Time"]}s` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Best Model */}
            <div className="card">
              <h2 className="card-title">Best Model</h2>
              <div style={{ background:"#F5F3FF", border:"1px solid #DDD6FE", borderRadius:8, padding:"12px 16px", marginBottom:14 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                  <Brain size={16} color="#6B5FED" />
                  <span style={{ fontSize:14, fontWeight:700, color:"#6B5FED" }}>{result.best_model_name}</span>
                </div>
                {Object.entries(result.metrics||{}).map(([k,v]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid #EDE9FE" }}>
                    <span style={{ fontSize:12, color:"#7C3AED" }}>{k}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:"#111827" }}>{v}</span>
                  </div>
                ))}
              </div>

              {result.why_best_model && (
                <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:8, padding:"10px 12px", marginBottom:14, display:"flex", gap:8 }}>
                  <Info size={14} color="#D97706" style={{ flexShrink:0, marginTop:1 }} />
                  <p style={{ fontSize:11, color:"#92400E", margin:0, lineHeight:1.5 }}>{result.why_best_model}</p>
                </div>
              )}

              {!savedModel ? (
                <div style={{ display:"flex", gap:8 }}>
                  <button className="btn btn-secondary btn-sm" style={{ flex:1, justifyContent:"center" }} onClick={() => setShowDetails(!showDetails)}>
                    {showDetails ? "Hide Details" : "View Model Details"}
                  </button>
                  <button className="btn btn-primary btn-sm" style={{ justifyContent:"center" }} onClick={handleSaveModel} disabled={saving}>
                    <Save size={12} /> {saving ? "Saving..." : "Save Model"}
                  </button>
                </div>
              ) : (
                <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:8, padding:"10px 12px" }}>
                  <p style={{ fontSize:12, color:"#15803D", fontWeight:600, margin:"0 0 8px" }}>✓ Model saved</p>
                  <button className="btn btn-primary btn-sm" style={{ width:"100%", justifyContent:"center" }} onClick={handleDownloadModel}>
                    <Download size={12} /> Download .pkl
                  </button>
                </div>
              )}
            </div>

            {/* Feature Importance */}
            <div className="card">
              <h2 className="card-title">Feature Importance</h2>
              {result.feature_importance?.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={result.feature_importance.slice(0,7).reverse()} layout="vertical">
                    <XAxis type="number" tick={{ fontSize:10 }} tickFormatter={v => v.toFixed(0)+"%"} />
                    <YAxis type="category" dataKey="Feature" tick={{ fontSize:10 }} width={90} />
                    <Tooltip formatter={v => v.toFixed(2)+"%"} />
                    <Bar dataKey="Importance" fill="#6B5FED" radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p style={{ fontSize:13, color:"#9CA3AF" }}>No feature importance available.</p>}
            </div>
          </div>

          {/* Model Details panel — toggled by "View Model Details" button, full width */}
          {showDetails && (
            <div className="card" style={{ marginBottom:20 }}>
              <h2 className="card-title">Model Details</h2>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:16, marginBottom:16 }}>
                <div>
                  <p style={{ fontSize:12, color:"#6B7280", marginBottom:4 }}>Training samples</p>
                  <p style={{ fontSize:16, fontWeight:700 }}>{result.n_train?.toLocaleString()}</p>
                </div>
                <div>
                  <p style={{ fontSize:12, color:"#6B7280", marginBottom:4 }}>Test samples</p>
                  <p style={{ fontSize:16, fontWeight:700 }}>{result.n_test?.toLocaleString()}</p>
                </div>
                <div>
                  <p style={{ fontSize:12, color:"#6B7280", marginBottom:4 }}>Task type</p>
                  <p style={{ fontSize:16, fontWeight:700, textTransform:"capitalize" }}>{result.task_type}</p>
                </div>
                <div>
                  <p style={{ fontSize:12, color:"#6B7280", marginBottom:4 }}>Features used</p>
                  <p style={{ fontSize:16, fontWeight:700 }}>{result.feature_names?.length}</p>
                </div>
              </div>
              <p style={{ fontSize:12, fontWeight:600, color:"#374151", marginBottom:8 }}>Features used:</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
                {result.feature_names?.map(f => (
                  <span key={f} style={{ fontSize:11, background:"#EEF0FF", color:"#6B5FED", padding:"3px 8px", borderRadius:5 }}>{f}</span>
                ))}
              </div>
              {result.sample_predictions?.length > 0 && (
                <>
                  <p style={{ fontSize:12, fontWeight:600, color:"#374151", marginBottom:8 }}>Sample Test Predictions (actual vs predicted):</p>
                  <table className="data-table">
                    <thead>
                      <tr><th>Actual</th><th>Predicted</th><th>Difference</th><th>% Error</th></tr>
                    </thead>
                    <tbody>
                      {result.sample_predictions.slice(0,6).map((r, i) => (
                        <tr key={i}>
                          <td>{r.actual}</td>
                          <td style={{ color:"#6B5FED", fontWeight:500 }}>{r.predicted}</td>
                          <td>{r.diff}</td>
                          <td style={{ color: r.pct_error > 20 ? "#EF4444" : "#22C55E" }}>
                            {r.pct_error !== null ? `${r.pct_error}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {/* Prediction Preview + Actions */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:20, marginBottom:20 }}>
            <div className="card">
              <h2 className="card-title">Prediction Preview</h2>
              {previewRows.length > 0 ? (
                <table className="data-table">
                  <thead><tr><th>Actual {target}</th><th>Predicted {target}</th><th>Difference</th><th>% Error</th></tr></thead>
                  <tbody>
                    {previewRows.map((r,i) => (
                      <tr key={i}>
                        <td>{Number(r.actual).toLocaleString()}</td>
                        <td style={{ color:"#6B5FED", fontWeight:600 }}>{Number(r.predicted).toLocaleString()}</td>
                        <td>{r.diff}</td>
                        <td><span className={`badge ${Number(r.pctErr) < 5 ? "badge-success" : "badge-warning"}`}>{r.pctErr}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p style={{ fontSize:13, color:"#9CA3AF" }}>No preview available for selected target.</p>}
            </div>

            <div className="card" style={{ minWidth:200 }}>
              <h2 className="card-title">Actions</h2>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <button className="btn btn-primary" onClick={() => setShowAll(!showAll)}>
                  <Target size={14} /> {showAll ? "Hide Predict Form" : "Predict on New Data"}
                </button>
                {!savedModel ? (
                  <button className="btn btn-secondary" onClick={handleSaveModel} disabled={saving}>
                    <Save size={14} /> {saving ? "Saving..." : "Save Model"}
                  </button>
                ) : (
                  <button className="btn btn-secondary" onClick={handleDownloadModel}>
                    <Download size={14} /> Download Model (.pkl)
                  </button>
                )}
              </div>

              {prediction && (
                <div style={{ marginTop:14, background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:8, padding:12, textAlign:"center" }}>
                  <p style={{ fontSize:11, color:"#6B7280", margin:"0 0 4px" }}>Predicted {target}</p>
                  <p style={{ fontSize:24, fontWeight:700, color:"#6B5FED", margin:0 }}>{prediction.prediction}</p>
                </div>
              )}
            </div>
          </div>

          {/* Predict form */}
          {showAll && (
            <div className="card">
              <h2 className="card-title">Predict on New Data</h2>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:14 }}>
                {(result.feature_names||[]).slice(0,8).map(feat => (
                  <div key={feat}>
                    <label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:4 }}>{feat}</label>
                    <input type="number" placeholder="Enter value"
                      value={inputs[feat]||""} onChange={e => setInputs(p => ({...p,[feat]:e.target.value}))}
                      style={{ width:"100%" }} />
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" onClick={handlePredict} disabled={store.isTraining}>
                <Target size={14} /> {store.isTraining ? "Predicting..." : "Get Prediction"}
              </button>
            </div>
          )}
        </>
      )}

      {!result && (
        <div style={{ textAlign:"center", paddingTop:60, color:"#9CA3AF" }}>
          <Brain size={48} style={{ opacity:0.2, marginBottom:12 }} />
          <p style={{ fontSize:15 }}>Select a target column and click "Train Models" to start.</p>
        </div>
      )}
    </div>
  );
}
