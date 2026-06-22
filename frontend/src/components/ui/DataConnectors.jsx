import { useState } from "react";
import { Database, Sheet, X, CheckCircle, Loader, Award } from "lucide-react";
import toast from "react-hot-toast";
import useStore from "../../store/useStore";
import {
  testDbConnection, listDbTables, queryDb,
  loadPublicSheet, loadPrivateSheet,
  uploadURL,
} from "../../api/client";

/**
 * Lets the user pull data in from their own MySQL/PostgreSQL
 * database, a Google Sheet, or their Kaggle account, instead of
 * uploading a file. Rendered as a collapsible panel — same pattern
 * as the plain URL loader on the Dashboard.
 */
export default function DataConnectors({ onLoaded }) {
  const store = useStore();
  const [tab, setTab] = useState("database"); // 'database' | 'sheets' | 'kaggle'

  // ── Database state ─────────────────────────────────────────
  const [dbType,   setDbType]   = useState("postgresql");
  const [host,     setHost]     = useState("");
  const [port,     setPort]     = useState("5432");
  const [database, setDatabase] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [testing,  setTesting]  = useState(false);
  const [connected,setConnected]= useState(false);
  const [tables,   setTables]   = useState([]);
  const [selTable, setSelTable] = useState("");
  const [customQuery, setCustomQuery] = useState("");
  const [useCustomQuery, setUseCustomQuery] = useState(false);
  const [loadingTable, setLoadingTable] = useState(false);

  // ── Google Sheets state ──────────────────────────────────────
  const [sheetUrl,  setSheetUrl]  = useState("");
  const [sheetTab,  setSheetTab]  = useState("");
  const [sheetMode, setSheetMode] = useState("public"); // 'public' | 'private'
  const [sheetLoading, setSheetLoading] = useState(false);

  // ── Kaggle state ──────────────────────────────────────────────
  const [kaggleUsername, setKaggleUsername] = useState(() => sessionStorage.getItem("dp_kaggle_user") || "");
  const [kaggleKey,      setKaggleKey]      = useState(() => sessionStorage.getItem("dp_kaggle_key")  || "");
  const [kaggleConnected,setKaggleConnected]= useState(() => !!(sessionStorage.getItem("dp_kaggle_user") && sessionStorage.getItem("dp_kaggle_key")));
  const [kaggleDatasetUrl, setKaggleDatasetUrl] = useState("");
  const [kaggleLoading,  setKaggleLoading]  = useState(false);

  const dbConfig = () => ({
    db_type: dbType, host, port: Number(port), database, username, password,
  });

  const handleTestConnection = async () => {
    if (!host || !database || !username) return toast.error("Fill in host, database, and username");
    setTesting(true);
    try {
      await testDbConnection(dbConfig());
      toast.success("Connection successful!");
      setConnected(true);
      const res = await listDbTables(dbConfig());
      setTables(res.tables || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Connection failed");
      setConnected(false);
    } finally { setTesting(false); }
  };

  const handleLoadTable = async () => {
    if (!useCustomQuery && !selTable) return toast.error("Select a table");
    if (useCustomQuery && !customQuery.trim()) return toast.error("Enter a SELECT query");
    setLoadingTable(true);
    try {
      const res = await queryDb(dbConfig(), useCustomQuery ? null : selTable, useCustomQuery ? customQuery : null);
      onLoaded(res);
      toast.success(`Loaded ${res.raw.shape[0].toLocaleString()} rows from ${dbType}!`);
      // Reset connection state so the panel collapses cleanly
      setConnected(false); setTables([]); setSelTable(""); setCustomQuery("");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Query failed");
    } finally { setLoadingTable(false); }
  };

  const handleLoadSheet = async () => {
    if (!sheetUrl.trim()) return toast.error("Paste a Google Sheet URL");
    setSheetLoading(true);
    try {
      const fn = sheetMode === "public" ? loadPublicSheet : loadPrivateSheet;
      const res = await fn(sheetUrl.trim(), sheetTab.trim() || undefined);
      onLoaded(res);
      toast.success("Google Sheet loaded!");
      setSheetUrl(""); setSheetTab("");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not load sheet");
    } finally { setSheetLoading(false); }
  };

  // ── Kaggle handlers ───────────────────────────────────────────
  const handleConnectKaggle = () => {
    if (!kaggleUsername.trim() || !kaggleKey.trim()) {
      return toast.error("Both Kaggle username and API key are required");
    }
    // Stored in sessionStorage only (not persisted to backend/db) — cleared
    // when the tab closes. Sent with each dataset-load request from here on.
    sessionStorage.setItem("dp_kaggle_user", kaggleUsername.trim());
    sessionStorage.setItem("dp_kaggle_key",  kaggleKey.trim());
    setKaggleConnected(true);
    toast.success("Kaggle account connected!");
  };

  const handleDisconnectKaggle = () => {
    sessionStorage.removeItem("dp_kaggle_user");
    sessionStorage.removeItem("dp_kaggle_key");
    setKaggleConnected(false);
    setKaggleUsername(""); setKaggleKey("");
  };

  const handleLoadKaggleDataset = async () => {
    if (!kaggleDatasetUrl.trim()) return toast.error("Paste a Kaggle dataset URL");
    if (!kaggleDatasetUrl.includes("kaggle.com")) return toast.error("This doesn't look like a Kaggle URL");
    setKaggleLoading(true);
    try {
      const res = await uploadURL(kaggleDatasetUrl.trim(), {
        username: sessionStorage.getItem("dp_kaggle_user"),
        key:      sessionStorage.getItem("dp_kaggle_key"),
      });
      onLoaded(res);
      toast.success("Kaggle dataset loaded!");
      setKaggleDatasetUrl("");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not load Kaggle dataset");
    } finally { setKaggleLoading(false); }
  };

  return (
    <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:8, padding:16, marginTop:8 }}>

      {/* Tab selector */}
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        <button
          onClick={() => setTab("database")}
          className="btn btn-sm"
          style={{ background: tab==="database" ? "#6B5FED" : "white", color: tab==="database" ? "white" : "#374151", border:"1px solid #E5E7EB" }}
        >
          <Database size={13} /> MySQL / PostgreSQL
        </button>
        <button
          onClick={() => setTab("sheets")}
          className="btn btn-sm"
          style={{ background: tab==="sheets" ? "#6B5FED" : "white", color: tab==="sheets" ? "white" : "#374151", border:"1px solid #E5E7EB" }}
        >
          <Sheet size={13} /> Google Sheets
        </button>
        <button
          onClick={() => setTab("kaggle")}
          className="btn btn-sm"
          style={{ background: tab==="kaggle" ? "#6B5FED" : "white", color: tab==="kaggle" ? "white" : "#374151", border:"1px solid #E5E7EB" }}
        >
          <Award size={13} /> Kaggle
        </button>
      </div>

      {/* ── Database tab ────────────────────────────────────── */}
      {tab === "database" && (
        <>
          {!connected ? (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
                <div>
                  <label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:3 }}>Database Type</label>
                  <select value={dbType} onChange={e => { setDbType(e.target.value); setPort(e.target.value === "mysql" ? "3306" : "5432"); }} style={{ width:"100%" }}>
                    <option value="postgresql">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:3 }}>Host</label>
                  <input value={host} onChange={e => setHost(e.target.value)} placeholder="e.g. db.example.com" style={{ width:"100%" }} />
                </div>
                <div>
                  <label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:3 }}>Port</label>
                  <input value={port} onChange={e => setPort(e.target.value)} style={{ width:"100%" }} />
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:3 }}>Database Name</label>
                  <input value={database} onChange={e => setDatabase(e.target.value)} placeholder="my_database" style={{ width:"100%" }} />
                </div>
                <div>
                  <label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:3 }}>Username</label>
                  <input value={username} onChange={e => setUsername(e.target.value)} placeholder="readonly_user" style={{ width:"100%" }} />
                </div>
                <div>
                  <label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:3 }}>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width:"100%" }} />
                </div>
              </div>
              <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:6, padding:"8px 10px", marginBottom:12, fontSize:11, color:"#92400E" }}>
                💡 For safety, use a <strong>read-only</strong> database user. Credentials are used only for this request and are never stored.
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleTestConnection} disabled={testing}>
                {testing ? <><Loader size={13} className="animate-spin" /> Testing...</> : "Test & Connect"}
              </button>
            </>
          ) : (
            <>
              <div className="alert alert-green" style={{ marginBottom:14 }}>
                <CheckCircle size={14} /> Connected to {dbType} at {host} · {tables.length} tables found
              </div>

              <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setUseCustomQuery(false)} style={{ background: !useCustomQuery ? "#EEF0FF" : "white", borderColor: !useCustomQuery ? "#6B5FED" : "#E5E7EB" }}>
                  Pick a Table
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setUseCustomQuery(true)} style={{ background: useCustomQuery ? "#EEF0FF" : "white", borderColor: useCustomQuery ? "#6B5FED" : "#E5E7EB" }}>
                  Write a Query
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setConnected(false); setTables([]); }} style={{ marginLeft:"auto" }}>
                  <X size={12} /> Disconnect
                </button>
              </div>

              {!useCustomQuery ? (
                <div style={{ display:"flex", gap:10, alignItems:"end" }}>
                  <div style={{ flex:1 }}>
                    <label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:3 }}>Table</label>
                    <select value={selTable} onChange={e => setSelTable(e.target.value)} style={{ width:"100%" }}>
                      <option value="">Select a table...</option>
                      {tables.map(t => <option key={t.name} value={t.name}>{t.name} (~{t.approx_rows ?? "?"} rows)</option>)}
                    </select>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleLoadTable} disabled={loadingTable || !selTable}>
                    {loadingTable ? "Loading..." : "Load Table"}
                  </button>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:3 }}>SELECT query (read-only — no INSERT/UPDATE/DELETE)</label>
                  <textarea
                    value={customQuery}
                    onChange={e => setCustomQuery(e.target.value)}
                    placeholder="SELECT * FROM orders WHERE created_at > '2024-01-01'"
                    style={{ width:"100%", fontSize:12, fontFamily:"monospace", padding:10, border:"1px solid #E5E7EB", borderRadius:8, minHeight:70, marginBottom:10, boxSizing:"border-box" }}
                  />
                  <button className="btn btn-primary btn-sm" onClick={handleLoadTable} disabled={loadingTable || !customQuery.trim()}>
                    {loadingTable ? "Running..." : "Run Query & Load"}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Google Sheets tab ───────────────────────────────── */}
      {tab === "sheets" && (
        <>
          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setSheetMode("public")} style={{ background: sheetMode==="public" ? "#EEF0FF" : "white", borderColor: sheetMode==="public" ? "#6B5FED" : "#E5E7EB" }}>
              Public Link
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSheetMode("private")} style={{ background: sheetMode==="private" ? "#EEF0FF" : "white", borderColor: sheetMode==="private" ? "#6B5FED" : "#E5E7EB" }}>
              Private Sheet
            </button>
          </div>

          {sheetMode === "public" ? (
            <p style={{ fontSize:11, color:"#9CA3AF", marginBottom:10 }}>
              Sheet must be shared as "Anyone with the link can view" (Share → General access).
            </p>
          ) : (
            <p style={{ fontSize:11, color:"#9CA3AF", marginBottom:10 }}>
              For private sheets, share with the server's service account email (ask your admin — requires <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> configured on the backend).
            </p>
          )}

          <div style={{ display:"flex", gap:10, marginBottom:10 }}>
            <input
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              style={{ flex:2, fontSize:13 }}
            />
            <input
              value={sheetTab}
              onChange={e => setSheetTab(e.target.value)}
              placeholder="Tab name (optional)"
              style={{ flex:1, fontSize:13 }}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleLoadSheet} disabled={sheetLoading || !sheetUrl.trim()}>
            {sheetLoading ? "Loading..." : "Load Sheet"}
          </button>
        </>
      )}

      {/* ── Kaggle tab ───────────────────────────────────────── */}
      {tab === "kaggle" && (
        <>
          {!kaggleConnected ? (
            <>
              <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:6, padding:"8px 10px", marginBottom:12, fontSize:11, color:"#92400E" }}>
                Kaggle requires an account to download data — this is a Kaggle rule, not a
                limitation of this tool. Your username and API key are stored only for this
                browser session and are never saved to our database.
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:3 }}>Kaggle Username</label>
                  <input value={kaggleUsername} onChange={e => setKaggleUsername(e.target.value)} placeholder="your_kaggle_username" style={{ width:"100%" }} />
                </div>
                <div>
                  <label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:3 }}>Kaggle API Key</label>
                  <input type="password" value={kaggleKey} onChange={e => setKaggleKey(e.target.value)} placeholder="API key" style={{ width:"100%" }} />
                </div>
              </div>
              <p style={{ fontSize:11, color:"#9CA3AF", marginBottom:12 }}>
                Get your API key from kaggle.com → Account → API → Create New Token.
                This downloads a kaggle.json file containing your username and key.
              </p>
              <button className="btn btn-primary btn-sm" onClick={handleConnectKaggle}>
                Connect Kaggle Account
              </button>
            </>
          ) : (
            <>
              <div className="alert alert-green" style={{ marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
                <CheckCircle size={14} /> Connected as {kaggleUsername}
                <button onClick={handleDisconnectKaggle} className="btn btn-secondary btn-sm" style={{ marginLeft:"auto" }}>
                  <X size={12} /> Disconnect
                </button>
              </div>

              <label style={{ fontSize:11, color:"#6B7280", display:"block", marginBottom:3 }}>Kaggle Dataset URL</label>
              <div style={{ display:"flex", gap:10 }}>
                <input
                  value={kaggleDatasetUrl}
                  onChange={e => setKaggleDatasetUrl(e.target.value)}
                  placeholder="https://www.kaggle.com/datasets/username/dataset-name"
                  style={{ flex:1, fontSize:13 }}
                />
                <button className="btn btn-primary btn-sm" onClick={handleLoadKaggleDataset} disabled={kaggleLoading || !kaggleDatasetUrl.trim()}>
                  {kaggleLoading ? "Loading..." : "Load Dataset"}
                </button>
              </div>
              <p style={{ fontSize:11, color:"#9CA3AF", marginTop:8 }}>
                If the dataset has multiple files, add <code>?select=filename.csv</code> to the URL to pick a specific one.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
