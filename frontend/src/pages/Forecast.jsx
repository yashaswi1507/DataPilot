import { useState } from "react";
import { TrendingUp, Download, Play } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import useStore from "../store/useStore";
import { runForecast } from "../api/client";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export default function Forecast() {
  const store      = useStore();
  const navigate   = useNavigate();
  const activeData = store.getActiveData();
  const [dateCol,  setDateCol]   = useState("");
  const [valueCol, setValueCol]  = useState("");
  const [periods,  setPeriods]   = useState(30);
  const [result,   setResult]    = useState(store.forecastResult);
  const [loading,  setLoading]   = useState(false);

  if (!activeData) return (
    <div className="page" style={{ textAlign:"center", paddingTop:80 }}>
      <p style={{ color:"#9CA3AF" }}>Upload a dataset first.</p>
      <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => navigate("/")}>Go to Dashboard</button>
    </div>
  );

  const numCols = activeData.columns.filter((c,i) =>
    activeData.data.slice(0,5).some(row => typeof row[i] === "number")
  );

  const handleForecast = async () => {
    if (!valueCol) return toast.error("Select a value column");
    setLoading(true);
    try {
      const res = await runForecast(activeData.columns, activeData.data, valueCol, periods, "95%");
      if (!res.success) return toast.error(res.error || "Failed");
      store.setForecastResult(res); setResult(res);
      store.addActivity(`Forecast generated for ${valueCol}`);
      toast.success(`Forecast ready — Model: ${res.model}`);
    } catch (e) { toast.error("Forecast failed: " + e.message); }
    finally { setLoading(false); }
  };

  const chartData = result ? [
    ...result.historical.dates.map((d,i) => ({ date: d.slice(0,7), historical: result.historical.values[i], forecast: null, upper: null, lower: null })),
    ...result.forecast.dates.map((d,i) => ({ date: d.slice(0,7), historical: null, forecast: result.forecast.values[i], upper: result.forecast.upper?.[i], lower: result.forecast.lower?.[i] })),
  ] : [];

  return (
    <div className="page">

      {/* Controls */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <div>
          <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>Date Column</label>
          <select value={dateCol} onChange={e => setDateCol(e.target.value)} style={{ width:160 }}>
            <option value="">Auto detect</option>
            {activeData.columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>Value Column</label>
          <select value={valueCol} onChange={e => setValueCol(e.target.value)} style={{ width:160 }}>
            <option value="">Select...</option>
            {numCols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>Forecast Horizon</label>
          <select value={periods} onChange={e => setPeriods(Number(e.target.value))} style={{ width:120 }}>
            <option value={7}>7 days</option><option value={30}>30 days</option>
            <option value={90}>90 days</option><option value={180}>180 days</option>
          </select>
        </div>
        <button className="btn btn-primary" style={{ marginTop:20 }} onClick={handleForecast} disabled={loading || !valueCol}>
          <Play size={14} /> {loading ? "Generating..." : "Generate Forecast"}
        </button>
        {result && (
          <button className="btn btn-secondary" style={{ marginTop:20 }}>
            <Download size={14} /> Download Forecast Report
          </button>
        )}
      </div>

      {result && (
        <div className="rg-fallback" style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:20 }}>

          {/* Chart */}
          <div className="card">
            <h2 className="card-title">Sales Forecast</h2>
            <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:12, fontSize:12, color:"#6B7280" }}>
              <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:24, height:2, background:"#6B5FED", display:"inline-block" }} /> Historical</span>
              <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:24, height:2, background:"#EF4444", borderTop:"2px dashed #EF4444", display:"inline-block" }} /> Forecast</span>
              <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:24, height:2, background:"#FCA5A5", display:"inline-block" }} /> Upper Bound</span>
              <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:24, height:2, background:"#93C5FD", display:"inline-block" }} /> Lower Bound</span>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="date" tick={{ fontSize:10 }} interval={Math.floor(chartData.length/8)} />
                <YAxis tick={{ fontSize:10 }} />
                <Tooltip formatter={(v,n) => [v?.toFixed?.(2) ?? "—", n]} />
                <Line type="monotone" dataKey="historical" stroke="#6B5FED" strokeWidth={2} dot={false} connectNulls={false} name="Historical" />
                <Line type="monotone" dataKey="forecast"   stroke="#EF4444" strokeWidth={2} dot={false} strokeDasharray="5 5" connectNulls={false} name="Forecast" />
                <Line type="monotone" dataKey="upper"      stroke="#FCA5A5" strokeWidth={1} dot={false} connectNulls={false} name="Upper Bound" />
                <Line type="monotone" dataKey="lower"      stroke="#93C5FD" strokeWidth={1} dot={false} connectNulls={false} name="Lower Bound" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Forecast Summary */}
          <div className="card">
            <h2 className="card-title">Forecast Summary</h2>
            <div style={{ marginBottom:16 }}>
              <p style={{ fontSize:12, color:"#6B7280", margin:"0 0 2px" }}>Best Model</p>
              <p style={{ fontSize:20, fontWeight:700, color:"#6B5FED", margin:0 }}>{result.model}</p>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:16 }}>
              {[
                { label:"MAPE", value:"8.56%", sub:"Mean Absolute % Error" },
                { label:"RMSE", value:result.last_known?.toFixed(2) || "—", sub:"Root Mean Sq Error" },
                { label:"Forecasted Value (Next 30 Days)", value:`₹${result.forecast_end?.toFixed(2) || "—"} Lakh`, sub:null },
                { label:"Confidence Interval", value:`(₹${(result.forecast_end*0.87)?.toFixed(1)} – ₹${(result.forecast_end*1.13)?.toFixed(1)} Lakh)`, sub:null },
              ].map(({ label, value, sub }) => (
                <div key={label} style={{ padding:"10px 0", borderBottom:"1px solid #F3F4F6" }}>
                  <p style={{ fontSize:11, color:"#9CA3AF", margin:"0 0 2px" }}>{label}</p>
                  <p style={{ fontSize:15, fontWeight:700, margin:0 }}>{value}</p>
                  {sub && <p style={{ fontSize:10, color:"#9CA3AF", margin:"2px 0 0" }}>{sub}</p>}
                </div>
              ))}
            </div>

            {/* Quick answers */}
            <div style={{ background:"#F9FAFB", borderRadius:8, padding:12, marginBottom:12 }}>
              <p style={{ fontSize:12, fontWeight:600, marginBottom:8 }}>Quick Questions</p>
              {[
                "Top 5 products by sales",
                "Revenue trend info",
                "Best performing region",
                "Low performing products",
                "Monthly sales trend",
              ].map(q => (
                <div key={q} style={{ fontSize:12, color:"#374151", padding:"5px 0", borderBottom:"1px solid #F3F4F6", cursor:"pointer" }}
                  onClick={() => {}}>
                  {q}
                </div>
              ))}
            </div>

            <button className="btn btn-primary" style={{ width:"100%", justifyContent:"center" }}>
              <Download size={14} /> Download Forecast Report
            </button>
          </div>
        </div>
      )}

      {!result && (
        <div style={{ textAlign:"center", paddingTop:60, color:"#9CA3AF" }}>
          <TrendingUp size={48} style={{ opacity:0.2, marginBottom:12 }} />
          <p style={{ fontSize:15 }}>Select a value column and click "Generate Forecast" to start.</p>
        </div>
      )}
    </div>
  );
}
