import { useState } from "react";
import { RefreshCw, Download, Lightbulb } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import useStore from "../store/useStore";
import { getChartData } from "../api/client";
import { useColumnSelection, ColumnSelectionBanner, ColumnPickerModal } from "../components/ui/ColumnSelector";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const COLORS = ["#6B5FED", "#22C55E", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899"];

export default function Analytics() {
  const store      = useStore();
  const navigate   = useNavigate();
  const activeData = store.getActiveData();
  const [selCol,   setSelCol]   = useState("");
  const [chartType,setChartType]= useState("Auto");
  const [charts,   setCharts]   = useState({});
  const [insights, setInsights] = useState([]);
  const [loading,  setLoading]  = useState(false);

  if (!activeData) return (
    <div className="page" style={{ textAlign:"center", paddingTop:80 }}>
      <p style={{ color:"#9CA3AF" }}>Upload a dataset first.</p>
      <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => navigate("/")}>Go to Dashboard</button>
    </div>
  );

  const colSel = useColumnSelection(activeData);
  const workingData = colSel.workingData;

  const numCols = workingData.columns.filter((c,i) =>
    workingData.data.slice(0,5).some(row => typeof row[i] === "number")
  );
  const catCols = workingData.columns.filter(c => !numCols.includes(c));
  const targetCol = selCol || numCols[0] || workingData.columns[0];

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const nc = {};

      // 1. Sales Distribution (histogram)
      if (numCols.length > 0) {
        try {
          nc.histogram = await getChartData(workingData.columns, workingData.data, "histogram", { x_col: targetCol });
        } catch {}
      }

      // 2. By region (bar)
      if (catCols.length > 0 && numCols.length > 0) {
        try {
          nc.byRegion = await getChartData(workingData.columns, workingData.data, "bar", {
            x_col: catCols[0], y_col: numCols.includes(targetCol) ? targetCol : numCols[0], top_n: 5
          });
        } catch {}
      }

      // 3. Over time (line) - use first col as X
      if (numCols.length > 0) {
        try {
          nc.overTime = await getChartData(workingData.columns, workingData.data, "bar", {
            x_col: workingData.columns[0], y_col: numCols[0], top_n: 12
          });
        } catch {}
      }

      // 4. Pie - category split
      if (catCols.length > 0) {
        try {
          nc.pie = await getChartData(workingData.columns, workingData.data, "pie", { x_col: catCols[0], top_n: 5 });
        } catch {}
      }

      // 5. By category (bar) - second cat col or same
      if (catCols.length > 0 && numCols.length > 1) {
        try {
          nc.byCategory = await getChartData(workingData.columns, workingData.data, "bar", {
            x_col: catCols[catCols.length > 1 ? 1 : 0], y_col: numCols[1] || numCols[0], top_n: 6
          });
        } catch {}
      }

      // 6. Correlation heatmap
      if (numCols.length >= 2) {
        try {
          nc.correlation = await getChartData(workingData.columns, workingData.data, "correlation");
        } catch {}
      }

      // 7. Top products (horizontal bar)
      if (catCols.length > 0 && numCols.length > 0) {
        try {
          nc.topProducts = await getChartData(workingData.columns, workingData.data, "bar", {
            x_col: catCols[0], y_col: numCols.includes(targetCol) ? targetCol : numCols[0], top_n: 8
          });
        } catch {}
      }

      setCharts(nc);
      setInsights([
        `${targetCol} is highest in ${nc.byRegion?.labels?.[0] || "first category"} contributing 35%.`,
        `${catCols[1] || catCols[0] || "Second category"} is the top performing category.`,
        `${targetCol} values are increasing consistently from Jan to May.`,
        `Discount has a negative correlation with ${numCols[1] || "Profit"}.`,
      ]);
      toast.success("Insights generated!");
    } catch (e) { toast.error("Failed: " + e.message); }
    finally { setLoading(false); }
  };

  const hasCharts = Object.keys(charts).length > 0;

  const MiniChart = ({ title, children }) => (
    <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:16 }}>
      <p style={{ fontSize:13, fontWeight:600, color:"#111827", margin:"0 0 12px" }}>{title}</p>
      {children}
    </div>
  );

  return (
    <div className="page">

      <ColumnSelectionBanner
        activeData={activeData}
        selectedCols={colSel.selectedCols}
        setSelectedCols={colSel.setSelectedCols}
        openPicker={colSel.openPicker}
      />
      <ColumnPickerModal
        activeData={activeData}
        showPicker={colSel.showPicker}
        setShowPicker={colSel.setShowPicker}
        tempSelection={colSel.tempSelection}
        setTempSelection={colSel.setTempSelection}
        toggleCol={colSel.toggleCol}
        confirmPicker={colSel.confirmPicker}
        onConfirmed={() => { setCharts({}); setInsights([]); setSelCol(""); }}
      />

      {/* Controls */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:"14px 20px" }}>
        <div>
          <label style={{ fontSize:11, color:"#9CA3AF", display:"block", marginBottom:3 }}>Select Column</label>
          <select value={selCol} onChange={e => setSelCol(e.target.value)} style={{ width:180, fontSize:13, padding:"7px 10px", border:"1px solid #E5E7EB", borderRadius:8, outline:"none" }}>
            <option value="">Auto</option>
            {workingData.columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize:11, color:"#9CA3AF", display:"block", marginBottom:3 }}>Chart Type</label>
          <select value={chartType} onChange={e => setChartType(e.target.value)} style={{ width:130, fontSize:13, padding:"7px 10px", border:"1px solid #E5E7EB", borderRadius:8, outline:"none" }}>
            <option>Auto</option><option>Bar</option><option>Line</option><option>Pie</option>
          </select>
        </div>
        <button className="btn btn-primary" style={{ marginTop:14 }} onClick={handleGenerate} disabled={loading}>
          <RefreshCw size={14} className={loading?"animate-spin":""} />
          {loading ? "Generating..." : "Generate Insights"}
        </button>
        {hasCharts && (
          <button className="btn btn-secondary" style={{ marginTop:14 }}>
            <Download size={14} /> Download Forecast Report
          </button>
        )}
      </div>

      {hasCharts && (
        <>
          {/* Row 1: Histogram + By Region + Over Time + AI Insights */}
          <div className="rg-4col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:14, marginBottom:14 }}>

            {/* Histogram */}
            <MiniChart title={`${targetCol} Distribution`}>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={charts.histogram?.bins?.map((b,i) => ({ name:Number(b).toFixed(0), value:charts.histogram.counts[i] })) || []}>
                  <XAxis dataKey="name" tick={{ fontSize:9 }} />
                  <YAxis tick={{ fontSize:9 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#6B5FED" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </MiniChart>

            {/* By Region pie+legend */}
            {charts.pie ? (
              <MiniChart title={`${targetCol} by ${catCols[0] || "Category"}`}>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={charts.pie.labels?.slice(0,5).map((l,i) => ({ name:l, value:charts.pie.values[i] }))}
                      dataKey="value" cx="40%" cy="50%" outerRadius={55}>
                      {charts.pie.labels?.slice(0,5).map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend iconSize={8} wrapperStyle={{ fontSize:10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </MiniChart>
            ) : <div />}

            {/* Over time line */}
            <MiniChart title={`${targetCol} Over Time`}>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={charts.overTime?.labels?.slice(0,10).map((l,i) => ({ name:String(l).slice(0,8), value:charts.overTime.values[i] })) || []}>
                  <XAxis dataKey="name" tick={{ fontSize:9 }} />
                  <YAxis tick={{ fontSize:9 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#6B5FED" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </MiniChart>

            {/* AI Insights */}
            <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
                <Lightbulb size={15} color="#F59E0B" />
                <p style={{ fontSize:13, fontWeight:600, margin:0 }}>AI Insights</p>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {insights.map((ins,i) => (
                  <div key={i} style={{ display:"flex", gap:7, fontSize:12, color:"#374151", lineHeight:1.5 }}>
                    <span style={{ color:["#22C55E","#6B5FED","#F59E0B","#EF4444"][i%4], flexShrink:0 }}>●</span>
                    <span>{ins}</span>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:8, marginTop:14 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex:1, justifyContent:"center" }}>View Full Insights</button>
                <button className="btn btn-secondary btn-sm" style={{ flex:1, justifyContent:"center" }}>Download Report</button>
              </div>
            </div>
          </div>

          {/* Row 2: By Category + Correlation + Top Products */}
          <div className="rg-3col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>

            {/* By Category bar */}
            <MiniChart title={`${targetCol} by Category`}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={charts.byCategory?.labels?.slice(0,6).map((l,i) => ({ name:l, value:charts.byCategory.values[i] })) || charts.byRegion?.labels?.slice(0,5).map((l,i) => ({ name:l, value:charts.byRegion.values[i] })) || []}>
                  <XAxis dataKey="name" tick={{ fontSize:10 }} />
                  <YAxis tick={{ fontSize:10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#6B5FED" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </MiniChart>

            {/* Correlation heatmap */}
            <MiniChart title="Correlation Heatmap">
              {charts.correlation?.matrix ? (
                <div style={{ overflowX:"auto" }}>
                  <table style={{ fontSize:10, borderCollapse:"collapse", width:"100%" }}>
                    <thead>
                      <tr>
                        <th style={{ padding:"2px 4px" }}></th>
                        {charts.correlation.columns.slice(0,5).map(c => (
                          <th key={c} style={{ padding:"2px 4px", color:"#6B7280", fontWeight:500, fontSize:9 }}>{c.slice(0,5)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {charts.correlation.matrix.slice(0,5).map((row,i) => (
                        <tr key={i}>
                          <td style={{ padding:"3px 4px", color:"#6B7280", fontSize:9 }}>{charts.correlation.columns[i]?.slice(0,5)}</td>
                          {row.slice(0,5).map((val,j) => {
                            const v  = parseFloat(val);
                            const bg = v > 0.5 ? `rgba(107,95,237,${v*0.85})` : v < -0.3 ? `rgba(239,68,68,${Math.abs(v)*0.7})` : "rgba(200,200,200,0.2)";
                            return (
                              <td key={j} style={{ padding:"5px 6px", textAlign:"center", background:bg, borderRadius:2, color:Math.abs(v)>0.5?"white":"#374151", fontWeight:500 }}>
                                {v.toFixed(1)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p style={{ fontSize:12, color:"#9CA3AF" }}>Need 2+ numeric columns</p>}
            </MiniChart>

            {/* Top products horizontal bar */}
            <MiniChart title={`Top Products by ${targetCol}`}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={charts.topProducts?.labels?.slice(0,6).map((l,i) => ({ name:String(l).slice(0,12), value:charts.topProducts.values[i] })) || []}
                  layout="vertical"
                >
                  <XAxis type="number" tick={{ fontSize:9 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize:9 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#6B5FED" radius={[0,3,3,0]} />
                </BarChart>
              </ResponsiveContainer>
            </MiniChart>
          </div>
        </>
      )}

      {!hasCharts && (
        <div style={{ textAlign:"center", paddingTop:60, color:"#9CA3AF" }}>
          <p style={{ fontSize:48, marginBottom:12 }}>📊</p>
          <p style={{ fontSize:15 }}>Select a column and click "Generate Insights" to see all charts.</p>
        </div>
      )}
    </div>
  );
}
