import { useState, useRef } from "react";
import { RefreshCw, Pin, Download } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";
import useStore from "../store/useStore";
import { getChartData } from "../api/client";
import CommentsPanel from "../components/ui/CommentsPanel";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const COLORS = ["#6B5FED","#22C55E","#F59E0B","#EF4444","#3B82F6","#EC4899","#8B5CF6","#14B8A6"];

const CHART_TYPES = [
  { id:"bar",         label:"Bar Chart",    icon:"📊" },
  { id:"line",        label:"Line Chart",   icon:"📈" },
  { id:"scatter",     label:"Scatter",      icon:"⚡" },
  { id:"histogram",   label:"Histogram",    icon:"📉" },
  { id:"pie",         label:"Pie Chart",    icon:"🥧" },
  { id:"correlation", label:"Heatmap",      icon:"🔥" },
];

export default function Charts() {
  const store      = useStore();
  const navigate   = useNavigate();
  const activeData = store.getActiveData();
  const [chartType,setChartType] = useState("bar");
  const [xCol,     setXCol]      = useState("");
  const [yCol,     setYCol]      = useState("");
  const [agg,      setAgg]       = useState("mean");
  const [topN,     setTopN]      = useState(15);
  const [chartData,setChartData] = useState(null);
  const [loading,  setLoading]   = useState(false);
  const chartRef = useRef(null);

  // Column selection — lets the user narrow down to a subset of columns
  // before working with charts. Useful for wide datasets where loading/
  // rendering with all columns is unnecessarily heavy. Cleaning still
  // always operates on the full dataset — this only affects this page.
  const [selectedCols, setSelectedCols] = useState(null); // null = not yet chosen
  const [showColPicker, setShowColPicker] = useState(false);
  const [tempSelection, setTempSelection] = useState([]);

  if (!activeData) return (
    <div className="page" style={{ textAlign:"center", paddingTop:80 }}>
      <p style={{ color:"#9CA3AF" }}>Upload a dataset first.</p>
      <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => navigate("/")}>Go to Dashboard</button>
    </div>
  );

  // Build the working dataset — either the full dataset, or a column
  // subset if the user has made a selection.
  const workingData = (() => {
    if (!selectedCols || selectedCols.length === activeData.columns.length) return activeData;
    const idxs = selectedCols.map(c => activeData.columns.indexOf(c));
    return {
      ...activeData,
      columns: selectedCols,
      data: activeData.data.map(row => idxs.map(i => row[i])),
    };
  })();

  const openColPicker = () => {
    setTempSelection(selectedCols || activeData.columns);
    setShowColPicker(true);
  };

  const confirmColPicker = () => {
    if (tempSelection.length === 0) return toast.error("Select at least one column");
    setSelectedCols(tempSelection);
    setShowColPicker(false);
    setChartData(null);
    setXCol(""); setYCol("");
    toast.success(`Working with ${tempSelection.length} of ${activeData.columns.length} columns`);
  };

  const toggleTempCol = (col) => {
    setTempSelection(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  const numCols = workingData.columns.filter((c,i) =>
    workingData.data.slice(0,5).some(row => typeof row[i] === "number")
  );
  const catCols = workingData.columns.filter(c => !numCols.includes(c));

  const handleGenerate = async () => {
    if (!xCol) return toast.error("Select a column");
    setLoading(true);
    try {
      const data = await getChartData(
        workingData.columns, workingData.data, chartType,
        { x_col:xCol, y_col:yCol, agg_func:agg, top_n:topN }
      );
      setChartData(data);
    } catch (e) { toast.error("Chart failed: " + e.message); }
    finally { setLoading(false); }
  };

  const handlePin = () => {
    if (!chartData) return;
    store.pinChart({ title:`${chartType} - ${xCol}`, type:chartType, xCol, yCol, data:chartData });
    toast.success("Chart pinned! View in Reports → Pinned Charts");
  };

  const handleExport = () => {
    if (!chartRef.current) return;
    try {
      const svg = chartRef.current.querySelector("svg");
      if (!svg) return toast.error("No chart to export");
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas  = document.createElement("canvas");
      const ctx     = canvas.getContext("2d");
      const img     = new Image();
      canvas.width  = svg.clientWidth  || 800;
      canvas.height = svg.clientHeight || 400;
      img.onload = () => {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const link = document.createElement("a");
        link.download = `datapilot_${chartType}_${xCol}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        toast.success("Chart exported as PNG!");
      };
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    } catch (e) {
      toast.error("Export failed: " + e.message);
    }
  };

  const renderChart = () => {
    if (!chartData) return null;

    if (chartType === "bar" && chartData.labels) {
      const data = chartData.labels.map((l,i) => ({ name:String(l).slice(0,15), value:chartData.values[i] }));
      return (
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={data} margin={{ top:10, right:10, bottom:40, left:10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="name" tick={{ fontSize:11 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize:11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#6B5FED" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "line" && chartData.labels) {
      const data = chartData.labels.map((l,i) => ({ name:String(l).slice(0,10), value:chartData.values[i] }));
      return (
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="name" tick={{ fontSize:11 }} />
            <YAxis tick={{ fontSize:11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#6B5FED" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "scatter" && chartData.x) {
      const data = chartData.x.map((x,i) => ({ x, y:chartData.y[i] }));
      return (
        <ResponsiveContainer width="100%" height={380}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="x" name={xCol} tick={{ fontSize:11 }} />
            <YAxis dataKey="y" name={yCol} tick={{ fontSize:11 }} />
            <Tooltip cursor={{ strokeDasharray:"3 3" }} />
            <Scatter data={data} fill="#6B5FED" opacity={0.65} />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "histogram" && chartData.bins) {
      const data = chartData.bins.map((b,i) => ({ name:Number(b).toFixed(1), value:chartData.counts[i] }));
      return (
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={data} barCategoryGap="2%">
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="name" tick={{ fontSize:10 }} />
            <YAxis tick={{ fontSize:11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#22C55E" />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "pie" && chartData.labels) {
      const data = chartData.labels.slice(0,8).map((l,i) => ({ name:l, value:chartData.values[i] }));
      return (
        <ResponsiveContainer width="100%" height={380}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={140} label={({ name,percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
              {data.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "correlation" && chartData.matrix) {
      const { columns, matrix } = chartData;
      const min = Math.min(...matrix.flat());
      const max = Math.max(...matrix.flat());
      const getColor = (v) => {
        const t = (v - min) / (max - min || 1);
        if (t > 0.65) return `rgba(107,95,237,${t*0.9})`;
        if (t < 0.35) return `rgba(239,68,68,${(1-t)*0.6})`;
        return "rgba(200,200,200,0.25)";
      };
      return (
        <div style={{ overflowX:"auto" }}>
          <table style={{ fontSize:12, borderCollapse:"collapse" }}>
            <thead>
              <tr>
                <th style={{ padding:"4px 8px" }}></th>
                {columns.slice(0,8).map(c => <th key={c} style={{ padding:"4px 8px", color:"#6B7280", fontWeight:500, fontSize:11 }}>{c.slice(0,8)}</th>)}
              </tr>
            </thead>
            <tbody>
              {matrix.slice(0,8).map((row, i) => (
                <tr key={i}>
                  <td style={{ padding:"4px 8px", color:"#6B7280", fontWeight:500, fontSize:11 }}>{columns[i]?.slice(0,8)}</td>
                  {row.slice(0,8).map((val, j) => (
                    <td key={j} style={{ padding:"8px 12px", textAlign:"center", background:getColor(val), borderRadius:3, color: Math.abs(val)>0.5?"white":"#374151", fontWeight:500 }}>
                      {Number(val).toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return <p style={{ color:"#9CA3AF", fontSize:13 }}>No chart data.</p>;
  };

  return (
    <div className="page">

      {/* Column selection prompt — shown on first visit, or via "Change Columns" */}
      {selectedCols === null && !showColPicker && (
        <div style={{ background:"#EEF0FF", border:"1px solid #DDD6FE", borderRadius:10, padding:"14px 18px", marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <p style={{ fontSize:13, fontWeight:600, color:"#6B5FED", margin:"0 0 2px" }}>
              This dataset has {activeData.columns.length} columns
            </p>
            <p style={{ fontSize:12, color:"#6B7280", margin:0 }}>
              Pick which ones to work with here for faster charts, or use all columns.
            </p>
          </div>
          <div style={{ display:"flex", gap:8, flexShrink:0 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedCols(activeData.columns); }}>
              Use All Columns
            </button>
            <button className="btn btn-primary btn-sm" onClick={openColPicker}>
              Select Columns
            </button>
          </div>
        </div>
      )}

      {/* Active selection indicator + change button — shown once a selection is made */}
      {selectedCols !== null && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, fontSize:12, color:"#6B7280" }}>
          <span>
            Working with <strong style={{ color:"#374151" }}>{selectedCols.length} of {activeData.columns.length}</strong> columns
          </span>
          <button className="btn btn-secondary btn-sm" onClick={openColPicker}>
            Change Columns
          </button>
        </div>
      )}

      {/* Column picker modal */}
      {showColPicker && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }} onClick={() => setShowColPicker(false)}>
          <div style={{ background:"white", borderRadius:12, padding:24, width:480, maxHeight:"70vh", display:"flex", flexDirection:"column" }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <h3 style={{ fontSize:15, fontWeight:700, margin:0 }}>Select columns to work with</h3>
              <button onClick={() => setShowColPicker(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9CA3AF", fontSize:18 }}>×</button>
            </div>

            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setTempSelection(activeData.columns)}>Select All</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setTempSelection([])}>Select None</button>
              <span style={{ fontSize:12, color:"#9CA3AF", marginLeft:"auto", alignSelf:"center" }}>{tempSelection.length} selected</span>
            </div>

            <div style={{ overflowY:"auto", flex:1, border:"1px solid #F3F4F6", borderRadius:8, padding:8, marginBottom:16 }}>
              {activeData.columns.map(col => (
                <label key={col} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 8px", cursor:"pointer", borderRadius:6 }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <input
                    type="checkbox"
                    checked={tempSelection.includes(col)}
                    onChange={() => toggleTempCol(col)}
                    style={{ width:14, height:14 }}
                  />
                  <span style={{ fontSize:13, color:"#374151" }}>{col}</span>
                </label>
              ))}
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button className="btn btn-secondary" style={{ flex:1, justifyContent:"center" }} onClick={() => setShowColPicker(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex:1, justifyContent:"center" }} onClick={confirmColPicker}>
                Use {tempSelection.length} Column{tempSelection.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chart type selector */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:10, marginBottom:20 }}>
        {CHART_TYPES.map(ct => (
          <button key={ct.id} onClick={() => setChartType(ct.id)}
            style={{ padding:"12px 8px", border:`1px solid ${chartType===ct.id?"#6B5FED":"#E5E7EB"}`, borderRadius:10, background: chartType===ct.id?"#EEF0FF":"white", cursor:"pointer", textAlign:"left", transition:"all 0.15s" }}>
            <span style={{ fontSize:18, display:"block", marginBottom:5 }}>{ct.icon}</span>
            <span style={{ fontSize:12, fontWeight:600, color: chartType===ct.id?"#6B5FED":"#374151" }}>{ct.label}</span>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:"16px 20px", marginBottom:20 }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:14 }}>
          <div>
            <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>
              {chartType==="scatter" ? "X Column" : "Column"}
            </label>
            <select value={xCol} onChange={e => setXCol(e.target.value)} style={{ width:"100%" }}>
              <option value="">Select column...</option>
              {workingData.columns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {["bar","line","scatter"].includes(chartType) && (
            <div>
              <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>
                {chartType==="scatter" ? "Y Column" : "Value Column"}
              </label>
              <select value={yCol} onChange={e => setYCol(e.target.value)} style={{ width:"100%" }}>
                <option value="">Select...</option>
                {numCols.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {["bar","line"].includes(chartType) && (
            <div>
              <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>Aggregation</label>
              <select value={agg} onChange={e => setAgg(e.target.value)} style={{ width:"100%" }}>
                <option value="mean">Average</option>
                <option value="sum">Total</option>
                <option value="max">Maximum</option>
                <option value="min">Minimum</option>
                <option value="count">Count</option>
              </select>
            </div>
          )}

          <div>
            <label style={{ fontSize:12, color:"#6B7280", display:"block", marginBottom:4 }}>Top N Results</label>
            <select value={topN} onChange={e => setTopN(Number(e.target.value))} style={{ width:"100%" }}>
              <option value={10}>Top 10</option>
              <option value={15}>Top 15</option>
              <option value={20}>Top 20</option>
              <option value={50}>Top 50</option>
            </select>
          </div>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
            <RefreshCw size={14} className={loading?"animate-spin":""} />
            {loading ? "Generating..." : "Generate Chart"}
          </button>
          {chartData && (
            <button className="btn btn-secondary" onClick={handlePin}>
              <Pin size={14} /> Pin to Reports
            </button>
          )}
        </div>
      </div>

      {/* Chart output */}
      {chartData && (
        <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:20 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <h3 style={{ fontSize:14, fontWeight:700, margin:0 }}>
              {CHART_TYPES.find(c => c.id===chartType)?.label} — {xCol}{yCol?` vs ${yCol}`:""}
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={13} /> Export PNG</button>
          </div>
          <div ref={chartRef}>
            {renderChart()}
          </div>
          <CommentsPanel targetType="chart" targetRef={`${chartType}-${xCol}-${yCol||""}`} />
        </div>
      )}

      {!chartData && (
        <div style={{ textAlign:"center", paddingTop:60, color:"#9CA3AF" }}>
          <p style={{ fontSize:40, marginBottom:12 }}>📊</p>
          <p style={{ fontSize:14 }}>Select a column and click "Generate Chart" to start.</p>
        </div>
      )}
    </div>
  );
}
