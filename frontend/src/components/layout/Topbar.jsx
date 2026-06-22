import { useLocation, useNavigate } from "react-router-dom";
import { Search, Moon, Sun, Bell, ChevronDown, LogOut, Menu } from "lucide-react";
import { useState, useEffect } from "react";
import useStore from "../../store/useStore";

const TITLES = {
  "/":                    { title:"Dashboard",              sub:"Welcome back! 👋" },
  "/overview":            { title:"Data Overview",          sub:"Browse and explore your dataset" },
  "/insights":            { title:"Analytics",              sub:"Analyse your data and discover insights" },
  "/charts":              { title:"Charts",                 sub:"Build visualizations from your data" },
  "/query":               { title:"Ask Your Data",          sub:"Ask and get answers from your data" },
  "/prep/clean":          { title:"Data Cleaning",          sub:"Clean and prepare your dataset" },
  "/prep/missing":        { title:"Missing Value Handling", sub:"Handle missing values intelligently" },
  "/prep/duplicates":     { title:"Duplicate Removal",      sub:"Find and remove duplicate rows" },
  "/prep/outliers":       { title:"Outlier Detection",      sub:"Detect and treat outliers" },
  "/prep/types":          { title:"Data Type Fixes",        sub:"Fix incorrect data types" },
  "/ml/testing":          { title:"Machine Learning Studio",sub:"Train and test ML models" },
  "/ml/comparison":       { title:"Model Comparison",       sub:"Compare model performance" },
  "/ml/predictions":      { title:"Predictions",            sub:"Make predictions on new data" },
  "/ml/features":         { title:"Feature Importance",     sub:"Understand what drives your model" },
  "/forecast/predict":    { title:"Forecasting Studio",     sub:"Generate time series forecasts" },
  "/forecast/scenarios":  { title:"Scenario Analysis",      sub:"Explore what-if scenarios" },
  "/reports":             { title:"Reports",                sub:"View and manage your reports" },
  "/settings":            { title:"Settings",               sub:"Manage your preferences" },
  "/help":                { title:"Help & Support",         sub:"Get help and find answers" },
};

export default function Topbar({ onMenuClick }) {
  const { pathname } = useLocation();
  const navigate     = useNavigate();
  const store        = useStore();
  const user         = store.user;
  const [showMenu, setShowMenu] = useState(false);

  const { title, sub } = TITLES[pathname] || { title:"DataPilot", sub:"" };
  const userName = user?.name || "User";
  const initials = userName.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();

  const handleLogout = () => {
    localStorage.removeItem("dp_token");
    localStorage.removeItem("dp_user");
    store.setUser(null);
    store.setToken(null);
    store.resetAll();
    navigate("/login");
  };

  const [isDark, setIsDark] = useState(() => localStorage.getItem("dp_theme") === "dark");

  useEffect(() => {
    document.body.classList.toggle("dark-mode", isDark);
    localStorage.setItem("dp_theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <header className="topbar" style={{
      height: 56,
      background: "white",
      borderBottom: "1px solid #E5E7EB",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px",
      position: "fixed",
      top: 0, left: 200, right: 0,
      zIndex: 40,
    }}>
      {/* Left */}
      <div style={{ display:"flex", alignItems:"center" }}>
        <button className="mobile-menu-btn" onClick={onMenuClick}>
          <Menu size={20} />
        </button>
        <div>
          <h1 style={{ fontSize:16, fontWeight:700, color:"#111827", margin:0, lineHeight:1.2 }}>{title}</h1>
          {sub && <p style={{ fontSize:12, color:"#6B7280", margin:0 }}>{sub}</p>}
        </div>
      </div>

      {/* Search */}
      <div className="topbar-search" style={{ flex:1, maxWidth:360, margin:"0 24px", position:"relative" }}>
        <Search size={14} style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }} />
        <input
          placeholder="Search anything..."
          style={{ width:"100%", background:"#F9FAFB", border:"1px solid #E5E7EB", borderRadius:8, padding:"8px 42px 8px 32px", fontSize:13, outline:"none", boxSizing:"border-box" }}
          onFocus={e => { e.target.style.borderColor="#6B5FED"; e.target.style.boxShadow="0 0 0 3px rgba(107,95,237,0.1)"; }}
          onBlur={e => { e.target.style.borderColor="#E5E7EB"; e.target.style.boxShadow="none"; }}
        />
        <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:10, color:"#9CA3AF", background:"#F3F4F6", padding:"2px 5px", borderRadius:4 }}>Ctrl K</span>
      </div>

      {/* Right */}
      <div className="topbar-right" style={{ display:"flex", alignItems:"center", gap:14 }}>
        <button onClick={() => setIsDark(!isDark)} style={{ background:"none", border:"none", cursor:"pointer", color:"#6B7280", display:"flex" }} title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button style={{ background:"none", border:"none", cursor:"pointer", position:"relative", color:"#6B7280", display:"flex" }}>
          <Bell size={18} />
          <span style={{ position:"absolute", top:-3, right:-3, width:16, height:16, background:"#6B5FED", borderRadius:"50%", fontSize:9, color:"white", display:"flex", alignItems:"center", justifyContent:"center" }}>3</span>
        </button>

        <div style={{ position:"relative" }}>
          <div
            onClick={() => setShowMenu(!showMenu)}
            style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}
          >
            <div style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#6B5FED,#EC4899)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:12, fontWeight:700 }}>
              {initials}
            </div>
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:"#111827", margin:0, lineHeight:1.2 }}>{userName}</p>
              <p style={{ fontSize:11, color:"#6B5FED", margin:0 }}>{user?.plan === "student" ? "🎓 Student Plan" : user?.plan === "basic" ? "Basic Plan" : user?.plan === "pro" ? "Pro Plan" : "Free Plan"}</p>
            </div>
            <ChevronDown size={14} color="#9CA3AF" />
          </div>

          {showMenu && (
            <div style={{ position:"absolute", top:44, right:0, background:"white", border:"1px solid #E5E7EB", borderRadius:10, padding:6, boxShadow:"0 8px 24px rgba(0,0,0,0.1)", minWidth:160, zIndex:100 }}>
              <button
                onClick={() => navigate("/settings")}
                style={{ width:"100%", background:"none", border:"none", padding:"8px 12px", fontSize:13, color:"#374151", cursor:"pointer", textAlign:"left", borderRadius:6, display:"flex", alignItems:"center", gap:8 }}
              >
                Settings
              </button>
              <div style={{ height:1, background:"#F3F4F6", margin:"4px 0" }} />
              <button
                onClick={handleLogout}
                style={{ width:"100%", background:"none", border:"none", padding:"8px 12px", fontSize:13, color:"#EF4444", cursor:"pointer", textAlign:"left", borderRadius:6, display:"flex", alignItems:"center", gap:8 }}
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
