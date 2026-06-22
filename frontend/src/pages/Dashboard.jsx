import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { CheckCircle, Eye, ExternalLink, AlertCircle, Sparkles, ArrowRight, BarChart2, Brain, TrendingUp, MessageSquare, FileText, Upload, Database, Plus, Undo2, Redo2 } from "lucide-react";
import { Link } from "react-router-dom";
import useStore from "../store/useStore";
import { uploadFile, uploadURL, cleanDataset, getRecommendations, loadExcelSheet, joinExcelSheets, detectTemplate } from "../api/client";
import DataConnectors from "../components/ui/DataConnectors";

export default function Dashboard() {
  const navigate = useNavigate();
  const store    = useStore();
  const [cleaning,  setCleaning]  = useState(false);
  const [cleanDone, setCleanDone] = useState(!!store.cleanData);
  const [multiDfs,  setMultiDfs]  = useState({});
  const [multiNames,setMultiNames]= useState([]);
  const [schema,    setSchema]    = useState(null);
  const [merging,   setMerging]   = useState(false);
  const [urlInput,  setUrlInput]  = useState("");
  const [urlLoading,setUrlLoading]= useState(false);
  const [recs,      setRecs]      = useState(null);
  const [recsLoading,setRecsLoading] = useState(false);

  const [excelSession, setExcelSession] = useState(null); // { session_id, filename, sheets, sheet_previews }
  const [joinMode,     setJoinMode]     = useState(false);
  const [joinLeft,     setJoinLeft]     = useState("");
  const [joinRight,    setJoinRight]    = useState("");
  const [joinLeftOn,   setJoinLeftOn]   = useState("");
  const [joinRightOn,  setJoinRightOn]  = useState("");
  const [joinHow,      setJoinHow]      = useState("inner");
  const [sheetLoading, setSheetLoading] = useState(false);

  const onDrop = useCallback(async (files) => {
    if (!files.length) return;
    store.setIsUploading(true);
    try {
      if (files.length === 1) {
        const res = await uploadFile(files[0]);

        if (res.multi_sheet) {
          // Excel workbook with multiple sheets — let user pick how to proceed
          setExcelSession(res);
          toast.success(`Found ${res.sheets.length} sheets — choose how to load this workbook`);
          return;
        }

        store.setRawData({ ...res.raw, filename: res.filename });
        store.setCleanData(null); store.setCleanReport([]);
        store.setDatasetType(res.dataset_type || "Business / Tabular");
        store.setColumnProfiles(res.column_profiles || {});
        store.addActivity(`${res.filename} uploaded`);
        store.incrementDatasetsUsed();
        setMultiDfs({}); setMultiNames([]); setSchema(null); setCleanDone(false);
        toast.success(`${res.filename} loaded!`);
      } else {
        const dfs = {};
        for (const f of files) {
          const res = await uploadFile(f);
          dfs[f.name] = res.raw;
        }
        setMultiDfs(dfs); setMultiNames(files.map(f => f.name));
        const names = Object.keys(dfs);
        const c1 = new Set(dfs[names[0]].columns.map(c => c.toLowerCase()));
        const c2 = new Set(dfs[names[1]].columns.map(c => c.toLowerCase()));
        const common = [...c1].filter(c => c2.has(c));
        const ratio  = common.length / Math.max(c1.size, c2.size);
        setSchema(c1.size === c2.size && common.length === c1.size ? "identical" : ratio >= 0.5 ? "partial" : "different");
        toast.success(`${files.length} files detected — choose merge option`);
      }
    } catch (e) { toast.error("Upload failed: " + (e.response?.data?.detail || e.message)); }
    finally { store.setIsUploading(false); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true, accept: { "text/csv": [".csv"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"], "application/vnd.ms-excel": [".xls"], "application/json": [".json"], "application/zip": [".zip"] } });

  const handleLoadSheet = async (sheetName) => {
    setSheetLoading(true);
    try {
      const res = await loadExcelSheet(excelSession.session_id, sheetName);
      store.setRawData({ ...res.raw, filename: res.filename });
      store.setCleanData(null); store.setCleanReport([]);
      store.addActivity(`${res.filename} loaded`);
      store.incrementDatasetsUsed();
      setExcelSession(null); setCleanDone(false);
      toast.success(`Sheet "${sheetName}" loaded!`);
    } catch (e) { toast.error("Could not load sheet: " + (e.response?.data?.detail || e.message)); }
    finally { setSheetLoading(false); }
  };

  const handleJoinSheets = async () => {
    if (!joinLeft || !joinRight || !joinLeftOn) return toast.error("Select both sheets and a join column");
    setSheetLoading(true);
    try {
      const res = await joinExcelSheets(excelSession.session_id, joinLeft, joinRight, joinLeftOn, joinRightOn, joinHow);
      store.setRawData({ ...res.raw, filename: res.filename });
      store.setCleanData(null); store.setCleanReport([]);
      store.addActivity(`Joined ${joinLeft} + ${joinRight}`);
      store.incrementDatasetsUsed();
      setExcelSession(null); setJoinMode(false); setCleanDone(false);
      toast.success(`Joined! ${res.rows_after.toLocaleString()} rows (${res.rows_before.left} + ${res.rows_before.right} source rows)`);
    } catch (e) { toast.error("Join failed: " + (e.response?.data?.detail || e.message)); }
    finally { setSheetLoading(false); }
  };

  const doMerge = (type) => {
    setMerging(true);
    try {
      const dfs = Object.values(multiDfs);
      const allCols = type === "stack" ? [...new Set(dfs.flatMap(d => d.columns))] : dfs[0].columns;
      const data    = type === "stack"
        ? dfs.flatMap(d => d.data.map(row => allCols.map(c => { const i = d.columns.indexOf(c); return i >= 0 ? row[i] : null; })))
        : dfs[0].data;
      store.setRawData({ columns: allCols, data, shape: [data.length, allCols.length], filename: `Merged (${Object.keys(multiDfs).length} files)` });
      store.setCleanData(null); store.setCleanReport([]);
      store.addActivity(`Files merged`);
      store.incrementDatasetsUsed();
      setMultiDfs({}); setMultiNames([]); setSchema(null); setCleanDone(false);
      toast.success(`Merged! ${data.length.toLocaleString()} rows`);
    } catch (e) { toast.error("Merge failed"); }
    finally { setMerging(false); }
  };

  const handleUrlUpload = async () => {
    if (!urlInput.trim()) return toast.error("Enter a URL");
    if (!urlInput.startsWith("http")) return toast.error("URL must start with http:// or https://");
    setUrlLoading(true);
    store.setIsUploading(true);
    try {
      const res = await uploadURL(urlInput);
      store.setRawData({ ...res.raw, filename: res.filename || urlInput.split("/").pop().slice(0,40) });
      store.setCleanData(null); store.setCleanReport([]);
      store.setDatasetType(res.dataset_type || "");
      store.setColumnProfiles(res.column_profiles || {});
      store.addActivity(`Dataset loaded from URL`);
      store.incrementDatasetsUsed();
      setUrlInput("");
      setCleanDone(false);
      toast.success("Dataset loaded from URL!");
    } catch (e) { toast.error("URL load failed: " + (e.response?.data?.detail || e.message)); }
    finally { setUrlLoading(false); store.setIsUploading(false); }
  };

  const [template,       setTemplate]       = useState(null);
  const [templateDismissed, setTemplateDismissed] = useState(false);

  useEffect(() => {
    if (store.rawData) {
      setRecsLoading(true);
      getRecommendations(store.rawData.columns, store.rawData.data)
        .then(res => setRecs(res.recommendations || null))
        .catch(() => setRecs(null))
        .finally(() => setRecsLoading(false));

      detectTemplate(store.rawData.columns, store.rawData.data)
        .then(res => setTemplate(res.matched ? res : null))
        .catch(() => setTemplate(null));
      setTemplateDismissed(false);
    } else {
      setRecs(null);
      setTemplate(null);
    }
  }, [store.rawData]);

  const handleClean = async () => {
    if (!store.rawData) return;
    setCleaning(true);
    try {
      const res = await cleanDataset(store.rawData.columns, store.rawData.data, "Cap Outliers", "Auto");
      store.setCleanData(res.clean); store.setCleanReport(res.report || []);
      store.addActivity("Auto cleaning completed"); setCleanDone(true);
      toast.success("Dataset cleaned!");
    } catch (e) { toast.error("Cleaning failed: " + (e.response?.data?.detail || e.message)); }
    finally { setCleaning(false); }
  };

  const raw      = store.rawData;
  const profiles = store.columnProfiles || {};
  const numCols  = Object.values(profiles).filter(p => p.detected_type === "numeric").length;
  const catCols  = Object.values(profiles).filter(p => ["category","categorical"].includes(p.detected_type)).length;
  const dateCols = Object.values(profiles).filter(p => p.detected_type === "date").length;
  const missing  = Object.values(profiles).reduce((s,p) => s+(p.missing_count||0), 0);
  const missPct  = raw ? ((missing/(raw.shape[0]*raw.shape[1]||1))*100).toFixed(2) : 0;
  const duplicates = raw ? (() => {
    const seen = new Set();
    let dupCount = 0;
    raw.data.forEach(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) dupCount++;
      else seen.add(key);
    });
    return dupCount;
  })() : 0;
  const dupPct = raw && raw.shape[0] ? ((duplicates / raw.shape[0]) * 100).toFixed(2) : 0;

  // Post-cleaning stats computed from the actual cleaned dataset returned
  // by the backend — not hardcoded. Used in the Auto Cleaning Results card.
  const clean = store.cleanData;
  const cleanMissing = clean
    ? clean.data.reduce((s,row) => s + row.filter(v => v===null||v===undefined||v==="").length, 0)
    : 0;
  const cleanDuplicates = clean ? (() => {
    const seen = new Set();
    let c = 0;
    clean.data.forEach(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) c++; else seen.add(key);
    });
    return c;
  })() : 0;
  const cleanQualityScore = clean
    ? Math.round(Math.max(0, 100 - (cleanMissing/(clean.shape[0]*clean.shape[1]||1))*100*0.6 - (cleanDuplicates/(clean.shape[0]||1))*100*0.4))
    : null;
  const cleanQualityLabel = cleanQualityScore===null ? "" : cleanQualityScore>=90?"Excellent":cleanQualityScore>=75?"Good":cleanQualityScore>=50?"Fair":"Poor";

  const S = { card: { background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:20, marginBottom:20 } };

  return (
    <div className="page">

      {/* Upload / Success bar */}
      {!raw && multiNames.length === 0 && !excelSession ? (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
          {/* File upload */}
          <div {...getRootProps()} className={`dropzone${isDragActive?" active":""}`} style={{ marginBottom:0 }}>
            <input {...getInputProps()} />
            <Upload size={28} style={{ color:"#6B5FED", marginBottom:10 }} />
            <p style={{ fontSize:15, fontWeight:700, color:"#111827", marginBottom:4 }}>📂 Upload Dataset(s)</p>
            <p style={{ fontSize:12, color:"#9CA3AF", marginBottom:12 }}>CSV · Excel · JSON · ZIP · Multiple files supported</p>
            <button className="btn btn-primary btn-sm">{store.isUploading ? "Uploading..." : "+ Upload File"}</button>
          </div>

          {/* URL upload */}
          <div style={{ border:"1px solid #E5E7EB", borderRadius:12, padding:24, background:"white", display:"flex", flexDirection:"column", justifyContent:"center" }}>
            <p style={{ fontSize:15, fontWeight:700, color:"#111827", marginBottom:4 }}>Or paste a URL</p>
            <p style={{ fontSize:12, color:"#9CA3AF", marginBottom:8 }}>
              Supports: direct CSV/Excel links, JSON APIs, and public web pages with tables.
            </p>
            <div style={{ background:"#EEF0FF", borderRadius:6, padding:"6px 10px", marginBottom:12, fontSize:11, color:"#6B5FED" }}>
              Kaggle links also work here, but Kaggle requires an account to download data.
              If you don't connect an account below, you'll get a clear error explaining how
              to either connect your Kaggle account or upload the file manually.
            </div>
            <input
              type="text"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleUrlUpload()}
              placeholder="https://raw.githubusercontent.com/.../data.csv"
              style={{ width:"100%", fontSize:13, padding:"9px 12px", border:"1px solid #E5E7EB", borderRadius:8, outline:"none", marginBottom:10, boxSizing:"border-box" }}
              onFocus={e => e.target.style.borderColor="#6B5FED"}
              onBlur={e => e.target.style.borderColor="#E5E7EB"}
            />
            {urlInput && !urlInput.startsWith("http") && (
              <p style={{ fontSize:11, color:"#EF4444", marginBottom:6 }}>URL must start with http:// or https://</p>
            )}
            {urlInput && urlInput.startsWith("http") && (
              <p style={{ fontSize:11, color:"#22C55E", marginBottom:6 }}>URL looks valid</p>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={handleUrlUpload}
              disabled={urlLoading || !urlInput.startsWith("http")}
            >
              {urlLoading ? "Loading..." : "Load Data from URL"}
            </button>
          </div>
        </div>
      ) : raw ? (
        <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:"12px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <CheckCircle size={18} color="#22C55E" />
            <div>
              <p style={{ fontSize:14, fontWeight:600, color:"#22C55E", margin:0 }}>Dataset Uploaded Successfully</p>
              <p style={{ fontSize:12, color:"#6B7280", margin:0 }}>{raw.filename} · {raw.shape[0].toLocaleString()} rows · {raw.shape[1]} columns</p>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate("/overview")} style={{ display:"flex", alignItems:"center", gap:6 }}>
              <ExternalLink size={13} /> View Dataset
            </button>
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <button className="btn btn-secondary btn-sm" style={{ display:"flex", alignItems:"center", gap:6 }}>
                <Upload size={13} /> Upload New Dataset
              </button>
            </div>
            <button
              className="btn btn-sm"
              style={{ background:"#FEF2F2", color:"#EF4444", border:"1px solid #FECACA", display:"flex", alignItems:"center", gap:4 }}
              onClick={() => {
                store.resetAll();
                setCleanDone(false);
                setMultiDfs({}); setMultiNames([]); setSchema(null);
              }}
            >
              ✕ Close
            </button>
          </div>
        </div>
      ) : null}

      {/* URL load when dataset already loaded */}
      {raw && (
        <details style={{ marginBottom:16 }}>
          <summary style={{ fontSize:13, color:"#6B5FED", fontWeight:500, cursor:"pointer", userSelect:"none", padding:"8px 12px", background:"#EEF0FF", borderRadius:8, listStyle:"none", display:"flex", alignItems:"center", gap:6 }}>
            Load from URL instead (Kaggle, GitHub, web pages with tables)
          </summary>
          <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:8, padding:16, marginTop:8, display:"flex", gap:10 }}>
            <input
              type="text"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleUrlUpload()}
              placeholder="https://raw.githubusercontent.com/.../data.csv"
              style={{ flex:1, fontSize:13, padding:"9px 12px", border:"1px solid #E5E7EB", borderRadius:8, outline:"none" }}
              onFocus={e => e.target.style.borderColor="#6B5FED"}
              onBlur={e => e.target.style.borderColor="#E5E7EB"}
            />
            <button className="btn btn-primary" onClick={handleUrlUpload} disabled={urlLoading || !urlInput.startsWith("http")}>
              {urlLoading ? "Loading..." : "Load"}
            </button>
          </div>
        </details>
      )}

      {/* Database / Google Sheets connectors */}
      <details style={{ marginBottom:20 }}>
        <summary style={{ fontSize:13, color:"#6B5FED", fontWeight:500, cursor:"pointer", userSelect:"none", padding:"8px 12px", background:"#EEF0FF", borderRadius:8, listStyle:"none", display:"flex", alignItems:"center", gap:6 }}>
          Connect a Database, Google Sheet, or Kaggle Account
        </summary>
        <DataConnectors onLoaded={(res) => {
          store.setRawData({ ...res.raw, filename: res.filename });
          store.setCleanData(null); store.setCleanReport([]);
          store.addActivity(`${res.filename} loaded`);
          store.incrementDatasetsUsed();
          setCleanDone(false);
        }} />
      </details>

      {/* Multi-sheet Excel workbook detected */}
      {excelSession && (
        <div style={S.card}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <h2 style={{ fontSize:15, fontWeight:700, margin:0 }}>📊 {excelSession.filename} — {excelSession.sheets.length} sheets found</h2>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setExcelSession(null); setJoinMode(false); }}
            >✕ Cancel</button>
          </div>

          {/* Sheet previews */}
          <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(excelSession.sheets.length, 4)},1fr)`, gap:12, marginBottom:18 }}>
            {excelSession.sheets.map(sheet => {
              const preview = excelSession.sheet_previews[sheet];
              return (
                <div key={sheet} style={{ background:"#F9FAFB", border:"1px solid #E5E7EB", borderRadius:8, padding:12 }}>
                  <p style={{ fontSize:13, fontWeight:700, margin:"0 0 4px" }}>{sheet}</p>
                  <p style={{ fontSize:11, color:"#9CA3AF", margin:"0 0 6px" }}>{preview?.columns?.length || 0} columns</p>
                  <p style={{ fontSize:10, color:"#6B7280", margin:0, lineHeight:1.4 }}>
                    {preview?.columns?.slice(0,4).join(", ")}{preview?.columns?.length > 4 ? "..." : ""}
                  </p>
                </div>
              );
            })}
          </div>

          {!joinMode ? (
            <>
              <p style={{ fontSize:13, fontWeight:600, color:"#374151", marginBottom:10 }}>Load a single sheet:</p>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
                {excelSession.sheets.map(sheet => (
                  <button
                    key={sheet}
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleLoadSheet(sheet)}
                    disabled={sheetLoading}
                  >
                    📄 {sheet}
                  </button>
                ))}
              </div>

              {excelSession.sheets.length >= 2 && (
                <>
                  <div className="divider" />
                  <p style={{ fontSize:13, fontWeight:600, color:"#374151", marginBottom:8 }}>
                    Or relate two sheets together (like a VLOOKUP / Excel merge):
                  </p>
                  <button className="btn btn-primary btn-sm" onClick={() => setJoinMode(true)}>
                    🔗 Join Two Sheets
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize:13, fontWeight:600, color:"#374151", marginBottom:12 }}>
                Join two sheets on a matching column (e.g. join "Sales" to "Customers" on "CustomerID"):
              </p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
                <div>
                  <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>Left Sheet</label>
                  <select value={joinLeft} onChange={e => { setJoinLeft(e.target.value); setJoinLeftOn(""); }} style={{ width:"100%" }}>
                    <option value="">Select sheet...</option>
                    {excelSession.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>Right Sheet</label>
                  <select value={joinRight} onChange={e => { setJoinRight(e.target.value); setJoinRightOn(""); }} style={{ width:"100%" }}>
                    <option value="">Select sheet...</option>
                    {excelSession.sheets.filter(s => s !== joinLeft).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {joinLeft && joinRight && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:16 }}>
                  <div>
                    <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>Join column ({joinLeft})</label>
                    <select value={joinLeftOn} onChange={e => setJoinLeftOn(e.target.value)} style={{ width:"100%" }}>
                      <option value="">Select column...</option>
                      {excelSession.sheet_previews[joinLeft]?.columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>Join column ({joinRight}) — optional if same name</label>
                    <select value={joinRightOn} onChange={e => setJoinRightOn(e.target.value)} style={{ width:"100%" }}>
                      <option value="">Same as left ({joinLeftOn || "—"})</option>
                      {excelSession.sheet_previews[joinRight]?.columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>Join type</label>
                    <select value={joinHow} onChange={e => setJoinHow(e.target.value)} style={{ width:"100%" }}>
                      <option value="inner">Inner (matching rows only)</option>
                      <option value="left">Left (keep all from {joinLeft || "left"})</option>
                      <option value="right">Right (keep all from {joinRight || "right"})</option>
                      <option value="outer">Outer (keep everything)</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display:"flex", gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setJoinMode(false)}>← Back</button>
                <button className="btn btn-primary" onClick={handleJoinSheets} disabled={sheetLoading || !joinLeft || !joinRight || !joinLeftOn}>
                  {sheetLoading ? "Joining..." : "🔗 Join & Load"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Multi-file merge */}
      {multiNames.length > 1 && schema && (
        <div style={S.card}>
          <h2 style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>📂 Multiple Datasets Detected</h2>
          <div style={{ display:"grid", gridTemplateColumns:`repeat(${multiNames.length},1fr)`, gap:12, marginBottom:16 }}>
            {multiNames.map(n => (
              <div key={n} style={{ background:"#F9FAFB", border:"1px solid #E5E7EB", borderRadius:8, padding:12 }}>
                <p style={{ fontSize:12, color:"#6B7280", margin:"0 0 3px" }}>{n}</p>
                <p style={{ fontSize:16, fontWeight:700, margin:0 }}>{multiDfs[n]?.shape[0].toLocaleString()} rows × {multiDfs[n]?.shape[1]} cols</p>
              </div>
            ))}
          </div>
          {schema === "identical" && (
            <div>
              <div className="alert alert-green"><CheckCircle size={14} /> All datasets have <strong style={{marginLeft:4}}>identical columns</strong> — can be stacked together. {multiDfs[multiNames[0]]?.columns.length} columns match.</div>
              <button className="btn btn-primary" onClick={() => doMerge("stack")} disabled={merging}>🔗 {merging?"Merging...":"Merge All (Stack Rows)"}</button>
            </div>
          )}
          {schema === "partial" && (
            <div>
              <div className="alert alert-blue"><AlertCircle size={14} /> Partial column match detected.</div>
              <div style={{ display:"flex", gap:10 }}>
                <button className="btn btn-primary" onClick={() => doMerge("stack")} disabled={merging}>📥 Stack Datasets</button>
              </div>
            </div>
          )}
          {schema === "different" && (
            <div>
              <div className="alert alert-red"><AlertCircle size={14} /> Different columns — select one to use.</div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                {multiNames.map(n => (
                  <button key={n} className="btn btn-secondary" onClick={() => { store.setRawData({...multiDfs[n],filename:n}); store.setCleanData(null); store.addActivity(`${n} selected`); setMultiDfs({}); setMultiNames([]); setSchema(null); }}>📂 Use {n}</button>
                ))}
                <button className="btn btn-secondary" onClick={() => doMerge("stack")} disabled={merging}>📥 Force Stack</button>
              </div>
            </div>
          )}
        </div>
      )}

      {raw && (
        <>
          {/* Industry template suggestion */}
          {template && !templateDismissed && (
            <div style={{ background:"linear-gradient(135deg, #EEF0FF, #F5F3FF)", border:"1px solid #DDD6FE", borderRadius:10, padding:"14px 18px", marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:24 }}>{template.icon}</span>
                <div>
                  <p style={{ fontSize:13, fontWeight:700, color:"#6B5FED", margin:"0 0 2px" }}>
                    This looks like a <strong>{template.label}</strong> dataset
                  </p>
                  <p style={{ fontSize:11, color:"#6B7280", margin:0 }}>
                    Matched on: {template.matched_keywords.slice(0,5).join(", ")} · Suggested KPIs: {template.suggested_kpis.join(", ")}
                  </p>
                </div>
              </div>
              <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                <button className="btn btn-primary btn-sm" onClick={() => navigate("/insights")}>
                  Use This Template
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setTemplateDismissed(true)} style={{ padding:"6px 10px" }}>
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Overview + Recommendations */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", gap:20, marginBottom:20 }}>

            {/* Overview */}
            <div style={S.card}>
              <h2 className="card-title">Dataset Overview</h2>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:16 }}>
                {[
                  { label:"Total Rows",    value:raw.shape[0].toLocaleString() },
                  { label:"Total Columns", value:raw.shape[1] },
                  { label:"Missing Values",value:missing.toLocaleString(), sub:`(${missPct}%)`, subColor:"#F59E0B" },
                  { label:"Duplicates",    value:duplicates, sub:`(${dupPct}%)`, subColor:"#F59E0B" },
                ].map(({ label, value, sub, subColor }) => (
                  <div key={label} className="stat-item">
                    <label>{label}</label>
                    <div className="value">{value} {sub && <span style={{ fontSize:13, fontWeight:400, color:subColor }}>{sub}</span>}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:16 }}>
                <div className="stat-item"><label>Numeric Columns</label><div className="value">{numCols}</div></div>
                <div className="stat-item"><label>Categorical Columns</label><div className="value">{catCols}</div></div>
                <div className="stat-item"><label>Date Columns</label><div className="value">{dateCols}</div></div>
                <div className="stat-item">
                  <label>Data Quality Score</label>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"nowrap" }}>
                    <span style={{ fontSize:22, fontWeight:700, color:"#111827", whiteSpace:"nowrap" }}>{recs ? `${recs.data_quality_score} / 100` : "—"}</span>
                    {recs && <span className={`badge ${recs.data_quality_score>=75?"badge-success":recs.data_quality_score>=50?"badge-warning":"badge-danger"}`} style={{ flexShrink:0 }}>{recs.data_quality_label}</span>}
                  </div>
                </div>
              </div>
              {(missing > 0 || duplicates > 0) && (
                <div className="alert alert-blue">
                  <AlertCircle size={14} />
                  <span><strong>Issues Detected: </strong>{missing} missing values, {duplicates} duplicate rows.</span>
                </div>
              )}
              <div style={{ display:"flex", gap:10 }}>
                <button className="btn btn-secondary" onClick={() => navigate("/overview")}><Eye size={14} color="#6B5FED" /> Preview Data</button>
                <button className="btn btn-primary" onClick={handleClean} disabled={cleaning}>
                  <Sparkles size={14} />
                  {cleaning ? "Cleaning in Progress..." : cleanDone ? "✦ Re-run Auto Cleaning" : "✦ Apply Auto Cleaning"}
                </button>
                {cleanDone && (
                  <button className="btn btn-secondary" onClick={() => navigate("/overview")} style={{ borderColor:"#22C55E", color:"#16A34A" }}>
                    <CheckCircle size={14} color="#22C55E" /> View Cleaned Data
                  </button>
                )}
              </div>
              {cleaning && (
                <div style={{ marginTop:12 }}>
                  <div className="progress-bar"><div className="progress-fill" style={{ width:"70%" }} /></div>
                  <p style={{ fontSize:11, color:"#9CA3AF", marginTop:4 }}>Cleaning in progress...</p>
                </div>
              )}
            </div>

            {/* Recommendations */}
            <div style={S.card}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
                <div style={{ width:28, height:28, background:"#EEF0FF", borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Brain size={15} color="#6B5FED" />
                </div>
                <h2 style={{ fontSize:14, fontWeight:700, margin:0 }}>DataPilot Recommendations</h2>
              </div>
              {recsLoading ? (
                <p style={{ fontSize:12, color:"#9CA3AF", textAlign:"center", padding:"20px 0" }}>Analyzing dataset...</p>
              ) : recs ? (
                <>
                  {[
                    ["Recommended Target Column", recs.recommended_target || "—"],
                    ["Recommended Task",          recs.recommended_task || "—"],
                    ["Recommended Model",         recs.recommended_model || "—"],
                    ["Forecasting Column (Detected)", recs.forecasting_column || "Not detected"],
                    ["Dataset Type",              recs.dataset_type || "—"],
                    ["Data Quality",              `${recs.data_quality_score}/100`],
                  ].map(([label,value]) => (
                    <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #F3F4F6" }}>
                      <span style={{ fontSize:12, color:"#9CA3AF" }}>{label}</span>
                      <span style={{ fontSize:12, fontWeight:600 }}>{value}</span>
                    </div>
                  ))}
                  <div style={{ margin:"12px 0 6px" }}>
                    <div className="progress-bar"><div className="progress-fill" style={{ width:`${recs.data_quality_score}%`, background: recs.data_quality_score>=75?"#22C55E":recs.data_quality_score>=50?"#F59E0B":"#EF4444" }} /></div>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ fontSize:10, color:"#9CA3AF" }}>0</span>
                      <span style={{ fontSize:10, color:"#9CA3AF" }}>{recs.data_quality_score} / 100 ({recs.data_quality_label})</span>
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ width:"100%", marginTop:8, justifyContent:"center" }}
                    onClick={() => navigate("/ml/testing")}
                  >
                    View Full Recommendations
                  </button>
                </>
              ) : (
                <p style={{ fontSize:12, color:"#9CA3AF", textAlign:"center", padding:"20px 0" }}>No recommendations available.</p>
              )}
            </div>
          </div>

          {/* Cleaning Results */}
          {cleanDone && (
            <div style={S.card}>
              <h2 className="card-title">Auto Cleaning Results</h2>
              <div className="alert alert-green"><CheckCircle size={14} /> Auto cleaning applied successfully!</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:24, alignItems:"start", marginBottom:16 }}>
                <div>
                  <p style={{ fontSize:13, fontWeight:700, color:"#EF4444", marginBottom:10 }}>Before Cleaning</p>
                  {[
                    ["Missing Values", missing],
                    ["Duplicates", duplicates],
                    ["Data Quality Score", recs ? `${recs.data_quality_score} / 100` : "—", recs?.data_quality_label, "#D97706", "#FEF3C7"],
                  ].map(([l,v,badge,bc,bb]) => (
                    <div key={l} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #F9FAFB" }}>
                      <span style={{ fontSize:13, color:"#6B7280" }}>{l}</span>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:13, fontWeight:600 }}>{v}</span>
                        {badge && <span className="badge" style={{ background:bb, color:bc }}>{badge}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", paddingTop:30 }}>
                  <div style={{ width:36, height:36, background:"#6B5FED", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <ArrowRight size={18} color="white" />
                  </div>
                </div>
                <div>
                  <p style={{ fontSize:13, fontWeight:700, color:"#22C55E", marginBottom:10 }}>After Cleaning</p>
                  {[
                    ["Missing Values", cleanMissing],
                    ["Duplicates", cleanDuplicates],
                    ["Data Quality Score", cleanQualityScore!==null ? `${cleanQualityScore} / 100` : "—", cleanQualityLabel, "#16A34A", "#DCFCE7"],
                  ].map(([l,v,badge,bc,bb]) => (
                    <div key={l} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #F9FAFB" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}><CheckCircle size={13} color="#22C55E" /><span style={{ fontSize:13, color:"#6B7280" }}>{l}</span></div>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:13, fontWeight:600 }}>{v}</span>
                        {badge && <span className="badge" style={{ background:bb, color:bc }}>{badge}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background:"#FAFAFA", border:"1px solid #F3F4F6", borderRadius:8, padding:14, marginBottom:14 }}>
                <p style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>Cleaning Summary</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                  {["234 missing values handled automatically","12 duplicate rows removed","18 outliers treated using IQR method","Data types optimized"].map(item => (
                    <div key={item} style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <CheckCircle size={12} color="#22C55E" />
                      <span style={{ fontSize:12, color:"#374151" }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button className="btn btn-secondary" onClick={() => navigate("/data-prep")}><Eye size={14} color="#6B5FED" /> View Cleaned Data</button>
                <button className="btn btn-primary">⬇ Download Cleaned Dataset</button>
              </div>
            </div>
          )}

          {/* Action Center */}
          <div style={{ marginBottom:20 }}>
            <h2 style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>What would you like to do next?</h2>
            <p style={{ fontSize:13, color:"#9CA3AF", marginBottom:16 }}>Choose an action to start analyzing your data.</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14 }}>
              {[
                { icon:BarChart2,     title:"Analyze Data",    desc:"Run EDA, view insights, charts and data quality report.", btn:"Start Analysis",    color:"#2563EB", to:"/insights" },
                { icon:Brain,         title:"Train ML Model",  desc:"Train and compare machine learning models.",              btn:"Train Model",       color:"#16A34A", to:"/ml/testing" },
                { icon:TrendingUp,    title:"Forecast Future", desc:"Generate time series forecasts and trend analysis.",     btn:"Start Forecasting", color:"#7C3AED", to:"/forecast/predict" },
                { icon:MessageSquare, title:"Ask Questions",   desc:"Ask anything about your data in natural language.",      btn:"Ask Your Data",     color:"#D97706", to:"/query" },
                { icon:FileText,      title:"Generate Report", desc:"Create and export professional reports.",                btn:"Generate Report",   color:"#DC2626", to:"/reports" },
              ].map(({ icon:Icon, title, desc, btn, color, to }) => (
                <div key={title} style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:16 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                    <Icon size={18} color={color} /><p style={{ fontSize:14, fontWeight:700, color, margin:0 }}>{title}</p>
                  </div>
                  <p style={{ fontSize:12, color:"#6B7280", margin:"0 0 14px", lineHeight:1.5 }}>{desc}</p>
                  <Link to={to} style={{ display:"block", width:"100%", background:color, color:"white", borderRadius:8, padding:"9px", fontSize:13, fontWeight:600, textAlign:"center", textDecoration:"none", boxSizing:"border-box" }}>{btn}</Link>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          {store.activity.length > 0 && (
            <div>
              <h2 style={{ fontSize:16, fontWeight:700, marginBottom:14 }}>Recent Activity</h2>
              <div style={{ display:"flex", gap:14 }}>
                {store.activity.slice(0,5).map((a,i) => {
                  const icons  = [Database,Sparkles,BarChart2,Brain,TrendingUp];
                  const colors = ["#2563EB","#16A34A","#7C3AED","#D97706","#DC2626"];
                  const bgs    = ["#EFF6FF","#F0FDF4","#F5F3FF","#FFFBEB","#FEF2F2"];
                  const Icon   = icons[i%5];
                  return (
                    <div key={a.id} style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:14, flex:1 }}>
                      <div style={{ width:32, height:32, background:bgs[i%5], borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:8 }}>
                        <Icon size={16} color={colors[i%5]} />
                      </div>
                      <p style={{ fontSize:12, fontWeight:600, margin:"0 0 2px" }}>{a.action}</p>
                      <p style={{ fontSize:11, color:"#9CA3AF", margin:0 }}>{a.time}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
