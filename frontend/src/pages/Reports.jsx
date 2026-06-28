import { useState, useEffect } from "react";
import { Plus, Download, Trash2, FileText, Clock, Calendar, Pause, Play, X, BarChart2, Pin } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import useStore from "../store/useStore";
import { exportReport, createSchedule, listSchedules, toggleSchedule, deleteSchedule } from "../api/client";
import CommentsPanel from "../components/ui/CommentsPanel";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export default function Reports() {
  const store      = useStore();
  const navigate   = useNavigate();
  const activeData = store.getActiveData();

  const [name,        setName]        = useState("");
  const [format,       setFormat]     = useState("pdf");
  const [exporting,    setExp]        = useState(false);

  const [showSchedule, setShowSchedule] = useState(false);
  const [schedules,    setSchedules]    = useState([]);
  const [loadingSched, setLoadingSched] = useState(false);

  // Schedule form state
  const [schedName,  setSchedName]  = useState("");
  const [schedFormat,setSchedFormat]= useState("pdf");
  const [frequency,  setFrequency]  = useState("once");
  const [schedDate,  setSchedDate]  = useState("");
  const [schedTime,  setSchedTime]  = useState("09:00");
  const [creating,   setCreating]   = useState(false);

  useEffect(() => { loadSchedules(); }, []);

  const loadSchedules = async () => {
    setLoadingSched(true);
    try {
      const res = await listSchedules();
      setSchedules(res.schedules || []);
    } catch (e) {
      // Likely not logged in or DB not connected locally — fail silently in UI
      console.warn("Could not load schedules:", e.message);
    } finally {
      setLoadingSched(false);
    }
  };

  const handleDownloadNow = async () => {
    if (!name.trim()) return toast.error("Enter a report name");
    setExp(true);
    try {
      const rawData = (format === "excel" && activeData) ? { columns: activeData.columns, data: activeData.data } : null;
      await exportReport(name.trim(), {}, [], [], format, rawData);
      store.addActivity(`Report "${name}" downloaded`);
      toast.success(`${format.toUpperCase()} downloaded!`);
      setName("");
    } catch (e) { toast.error("Export failed: " + e.message); }
    finally { setExp(false); }
  };

  const handleCreateSchedule = async () => {
    if (!activeData) return toast.error("Upload a dataset first");
    if (!schedName.trim()) return toast.error("Enter a report name");
    if (frequency !== "daily" && !schedDate) return toast.error("Pick a date");

    setCreating(true);
    try {
      const res = await createSchedule({
        report_name:    schedName.trim(),
        columns:        activeData.columns,
        data:           activeData.data,
        report_format:  schedFormat,
        frequency,
        scheduled_time: schedTime,
        scheduled_date: schedDate || null,
        kpis: {}, insights: [],
      });
      toast.success(res.message || "Report scheduled!");
      store.addActivity(`Scheduled report: ${schedName}`);
      setSchedName(""); setSchedDate("");
      setShowSchedule(false);
      loadSchedules();
    } catch (e) {
      toast.error("Could not schedule: " + (e.response?.data?.detail || e.message));
    } finally { setCreating(false); }
  };

  const handleToggle = async (id) => {
    try {
      await toggleSchedule(id);
      loadSchedules();
    } catch (e) { toast.error("Failed to update schedule"); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteSchedule(id);
      toast.success("Schedule deleted");
      loadSchedules();
    } catch (e) { toast.error("Failed to delete schedule"); }
  };

  const freqLabel = { once:"One-time", daily:"Daily", weekly:"Weekly", monthly:"Monthly" };

  return (
    <div className="page">

      {/* Quick download */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, flexWrap:"wrap" }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Report name..." style={{ width:220, fontSize:13 }} />
        <select value={format} onChange={e => setFormat(e.target.value)} style={{ width:100 }}>
          <option value="pdf">PDF</option>
          <option value="html">HTML</option>
          <option value="ppt">PPT</option>
          <option value="excel">Excel</option>
        </select>
        <button className="btn btn-primary" onClick={handleDownloadNow} disabled={exporting}>
          <Download size={14} /> {exporting ? "Exporting..." : "Download Now"}
        </button>
        <button className="btn btn-secondary" onClick={() => setShowSchedule(!showSchedule)}>
          <Clock size={14} /> Schedule a Report
        </button>
      </div>

      {/* Schedule creation form */}
      {showSchedule && (
        <div className="card" style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <h2 className="card-title" style={{ marginBottom:0 }}>📅 Schedule a New Report</h2>
            <button onClick={() => setShowSchedule(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9CA3AF" }}><X size={16} /></button>
          </div>

          {!activeData && (
            <div className="alert alert-blue" style={{ marginBottom:14 }}>
              Upload a dataset first — the schedule snapshots your current data so it can run automatically.
            </div>
          )}

          <div className="rg-2col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
            <div>
              <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>Report Name</label>
              <input value={schedName} onChange={e => setSchedName(e.target.value)} placeholder="e.g. Weekly Sales Summary" style={{ width:"100%" }} />
            </div>
            <div>
              <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>Format</label>
              <select value={schedFormat} onChange={e => setSchedFormat(e.target.value)} style={{ width:"100%" }}>
                <option value="pdf">PDF</option>
                <option value="html">HTML</option>
                <option value="ppt">PPT</option>
                <option value="excel">Excel</option>
              </select>
            </div>
          </div>

          <div className="rg-3col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:16 }}>
            <div>
              <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>Frequency</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value)} style={{ width:"100%" }}>
                <option value="once">One-time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>
                {frequency === "daily" ? "Start Date (optional)" : frequency === "weekly" ? "Pick a date (sets day-of-week)" : frequency === "monthly" ? "Pick a date (sets day-of-month)" : "Date"}
              </label>
              <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} style={{ width:"100%" }} min={new Date().toISOString().slice(0,10)} />
            </div>
            <div>
              <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>Time</label>
              <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} style={{ width:"100%" }} />
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleCreateSchedule} disabled={creating || !activeData}>
            <Calendar size={14} /> {creating ? "Scheduling..." : "Create Schedule"}
          </button>

          <p style={{ fontSize:11, color:"#9CA3AF", marginTop:10 }}>
            Note: scheduled reports require the backend server to stay running continuously. Email delivery isn't available yet — reports appear below automatically once generated.
          </p>
        </div>
      )}

      {/* Pinned Charts — this is where "Pin to Reports" from the Charts page lands */}
      {store.pinnedCharts.length > 0 && (
        <div className="card" style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <h2 className="card-title" style={{ marginBottom:0, display:"flex", alignItems:"center", gap:6 }}>
              <Pin size={15} color="#6B5FED" /> Pinned Charts ({store.pinnedCharts.length})
            </h2>
          </div>
          <div className="rg-2col" style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
            {store.pinnedCharts.map(chart => (
              <div key={chart.id} style={{ border:"1px solid #E5E7EB", borderRadius:8, padding:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start", marginBottom:10 }}>
                  <p style={{ fontSize:13, fontWeight:600, margin:0 }}>{chart.title}</p>
                  <button onClick={() => store.unpinChart(chart.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#D1D5DB" }}>
                    <X size={14} />
                  </button>
                </div>
                <MiniPinnedChart chart={chart} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active schedules */}
      <div className="card" style={{ marginBottom:20 }}>
        <h2 className="card-title">Scheduled Reports</h2>
        {loadingSched ? (
          <p style={{ fontSize:13, color:"#9CA3AF" }}>Loading...</p>
        ) : schedules.length === 0 ? (
          <p style={{ fontSize:13, color:"#9CA3AF" }}>No scheduled reports yet. Click "Schedule a Report" above to create one.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Frequency</th><th>Format</th><th>Next Run</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {schedules.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight:500 }}>{s.report_name}</td>
                  <td><span className="badge badge-purple">{freqLabel[s.frequency] || s.frequency}</span></td>
                  <td style={{ textTransform:"uppercase", fontSize:12, color:"#6B7280" }}>{s.report_format}</td>
                  <td style={{ color:"#6B7280" }}>{s.next_run_at ? new Date(s.next_run_at).toLocaleString() : "—"}</td>
                  <td>
                    <span className={`badge ${s.is_active ? "badge-success" : "badge-warning"}`}>
                      {s.is_active ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display:"flex", gap:6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleToggle(s.id)}>
                        {s.is_active ? <Pause size={12} /> : <Play size={12} />}
                      </button>
                      <button className="btn btn-secondary btn-sm" style={{ color:"#EF4444", borderColor:"#FEE2E2" }} onClick={() => handleDelete(s.id)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Generated reports from saved store */}
      <div className="card">
        <h2 className="card-title">My Reports</h2>
        {store.savedReports.length === 0 ? (
          <p style={{ fontSize:13, color:"#9CA3AF" }}>No reports generated yet. Use "Download Now" above, or pin charts from the Charts page and save a report.</p>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {store.savedReports.map((r, i) => (
              <div key={i} style={{ border:"1px solid #F3F4F6", borderRadius:8, padding:12 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <FileText size={14} color="#6B5FED" />
                    <span style={{ fontWeight:500, fontSize:13 }}>{r.name}</span>
                    <span style={{ fontSize:11, color:"#9CA3AF" }}>{r.charts?.length || 0} charts</span>
                  </div>
                  <span style={{ fontSize:11, color:"#9CA3AF" }}>{new Date(r.createdAt || Date.now()).toLocaleString()}</span>
                </div>
                <CommentsPanel targetType="report" targetRef={r.name} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const COLORS = ["#6B5FED","#22C55E","#F59E0B","#EF4444","#3B82F6","#EC4899"];

function MiniPinnedChart({ chart }) {
  const { type, data } = chart;

  if (!data) return <p style={{ fontSize:12, color:"#9CA3AF" }}>No data</p>;

  if (type === "bar" && data.labels) {
    const rows = data.labels.slice(0,8).map((l,i) => ({ name:String(l).slice(0,10), value:data.values[i] }));
    return (
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={rows}>
          <XAxis dataKey="name" tick={{ fontSize:9 }} />
          <YAxis tick={{ fontSize:9 }} />
          <Tooltip />
          <Bar dataKey="value" fill="#6B5FED" radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === "line" && data.labels) {
    const rows = data.labels.slice(0,10).map((l,i) => ({ name:String(l).slice(0,8), value:data.values[i] }));
    return (
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={rows}>
          <XAxis dataKey="name" tick={{ fontSize:9 }} />
          <YAxis tick={{ fontSize:9 }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#6B5FED" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === "pie" && data.labels) {
    const rows = data.labels.slice(0,6).map((l,i) => ({ name:l, value:data.values[i] }));
    return (
      <ResponsiveContainer width="100%" height={140}>
        <PieChart>
          <Pie data={rows} dataKey="value" cx="50%" cy="50%" outerRadius={50}>
            {rows.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return <p style={{ fontSize:12, color:"#9CA3AF" }}>{type} chart — preview not available</p>;
}
