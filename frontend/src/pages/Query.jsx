import { useState, useRef, useEffect } from "react";
import { Send, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import useStore from "../store/useStore";
import { runQuery } from "../api/client";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

function buildQuickQuestions(activeData) {
  if (!activeData) return [];
  const cols = activeData.columns;
  const numCols = cols.filter((c,i) =>
    activeData.data.slice(0,5).some(row => typeof row[i] === "number")
  );
  const catCols = cols.filter(c => !numCols.includes(c));
  const dateCols = cols.filter(c => /date|time|year|month/i.test(c));

  const qs = [];
  if (numCols.length && catCols.length) {
    qs.push(`Which ${catCols[0]} has the highest ${numCols[0]}?`);
    qs.push(`Average ${numCols[0]} by ${catCols[0]}`);
  }
  if (numCols.length) {
    qs.push(`Top 5 by ${numCols[0]}`);
    qs.push(`What is the total ${numCols[0]}?`);
  }
  if (catCols.length) {
    qs.push(`Count by ${catCols[0]}`);
  }
  if (dateCols.length && numCols.length) {
    qs.push(`${numCols[0]} trend over time`);
  }
  if (numCols.length > 1) {
    qs.push(`Compare ${numCols[0]} and ${numCols[1]}`);
  }
  return qs.slice(0, 6);
}

export default function Query() {
  const store      = useStore();
  const navigate   = useNavigate();
  const activeData = store.getActiveData();
  const [query,    setQuery]    = useState("");
  const [messages, setMessages] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const bottomRef = useRef(null);
  const QUICK = buildQuickQuestions(activeData);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  if (!activeData) return (
    <div className="page" style={{ textAlign:"center", paddingTop:80 }}>
      <p style={{ color:"#9CA3AF" }}>Upload a dataset first.</p>
      <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => navigate("/")}>Go to Dashboard</button>
    </div>
  );

  const ask = async (q) => {
    if (!q.trim()) return;
    const userMsg = { role:"user", text:q, time: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, userMsg]);
    setQuery("");
    setLoading(true);
    try {
      const res = await runQuery(activeData.columns, activeData.data, q);
      store.addQueryToHistory({ query:q, result:res, time:userMsg.time });

      let responseText = "";
      let chartData    = null;

      if (res.error) {
        responseText = `❌ ${res.error}`;
      } else if (res.result?.type === "scalar") {
        responseText = `The ${res.query_desc}: **${res.result.value?.toLocaleString?.() ?? res.result.value}**`;
      } else if (res.result?.type === "series") {
        const top = res.result.index[0];
        const val = res.result.values[0];
        responseText = `The ${res.query_desc}. **${top}** leads with ${typeof val === "number" ? val.toLocaleString() : val}.`;
        if (res.insights?.length) responseText += "\n\n" + res.insights[0];
        chartData = { labels: res.result.index.slice(0,8), values: res.result.values.slice(0,8) };
      } else {
        responseText = res.query_desc || "Query processed.";
      }

      const botMsg = { role:"bot", text:responseText, chart:chartData, time:new Date().toLocaleTimeString() };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
      setMessages(prev => [...prev, { role:"bot", text:"❌ " + e.message, time:new Date().toLocaleTimeString() }]);
    } finally { setLoading(false); }
  };

  const formatText = (text) => {
    return text.split("**").map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
  };

  return (
    <div className="page" style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 56px - 48px)" }}>

      {/* Chat area */}
      <div style={{ flex:1, overflowY:"auto", marginBottom:14 }}>

        {/* Quick questions */}
        {messages.length === 0 && (
          <div style={{ marginBottom:20 }}>
            <h3 style={{ fontSize:14, fontWeight:600, marginBottom:12, color:"#374151" }}>Quick Questions</h3>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {QUICK.map(q => (
                <button key={q} onClick={() => ask(q)}
                  style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:20, padding:"7px 14px", fontSize:12, color:"#374151", cursor:"pointer", transition:"all 0.15s" }}
                  onMouseEnter={e => e.target.style.borderColor="#6B5FED"}
                  onMouseLeave={e => e.target.style.borderColor="#E5E7EB"}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display:"flex", justifyContent: msg.role==="user" ? "flex-end" : "flex-start" }}>
              {msg.role === "bot" && (
                <div style={{ width:28, height:28, background:"linear-gradient(135deg,#6B5FED,#EC4899)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", marginRight:10, flexShrink:0, marginTop:4 }}>
                  <span style={{ fontSize:11, color:"white", fontWeight:700 }}>D</span>
                </div>
              )}
              <div style={{ maxWidth:"70%" }}>
                <div style={{
                  background: msg.role==="user" ? "#6B5FED" : "white",
                  color:      msg.role==="user" ? "white" : "#111827",
                  border:     msg.role==="user" ? "none" : "1px solid #E5E7EB",
                  borderRadius: msg.role==="user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                  padding:"10px 14px", fontSize:13, lineHeight:1.6,
                }}>
                  {formatText(msg.text)}
                </div>

                {/* Chart if available */}
                {msg.chart && (
                  <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:14, marginTop:10 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                      <button onClick={() => ask("Show monthly sales trend")}
                        style={{ background:"#EEF0FF", color:"#6B5FED", border:"none", borderRadius:20, padding:"5px 14px", fontSize:12, fontWeight:500, cursor:"pointer" }}>
                        Show monthly sales trend.
                      </button>
                    </div>
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart data={msg.chart.labels.map((l,j) => ({ name:l, value:msg.chart.values[j] }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                        <XAxis dataKey="name" tick={{ fontSize:10 }} />
                        <YAxis tick={{ fontSize:10 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke="#6B5FED" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <p style={{ fontSize:10, color:"#9CA3AF", marginTop:4, textAlign: msg.role==="user" ? "right" : "left" }}>{msg.time}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <div style={{ width:28, height:28, background:"linear-gradient(135deg,#6B5FED,#EC4899)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontSize:11, color:"white", fontWeight:700 }}>D</span>
              </div>
              <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:"4px 18px 18px 18px", padding:"10px 16px", display:"flex", gap:4 }}>
                {[0,1,2].map(j => (
                  <div key={j} style={{ width:6, height:6, borderRadius:"50%", background:"#6B5FED", animation:`bounce 1s ${j*0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:12, padding:"8px 8px 8px 16px", display:"flex", alignItems:"center", gap:10 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key==="Enter" && !e.shiftKey && ask(query)}
          placeholder="Ask in any language... e.g. Hindi, English, Spanish"
          style={{ flex:1, border:"none", outline:"none", fontSize:13, color:"#111827", background:"transparent" }}
        />
        <button onClick={() => ask(query)} disabled={loading || !query.trim()}
          style={{ width:36, height:36, borderRadius:"50%", background:"#6B5FED", border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, opacity: !query.trim() ? 0.5 : 1 }}>
          <Send size={15} color="white" />
        </button>
      </div>

      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }`}</style>
    </div>
  );
}
