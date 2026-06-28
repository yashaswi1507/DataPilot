import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import useStore from "../../store/useStore";
import {
  LayoutDashboard, Database, Lightbulb, BarChart2, MessageSquare,
  Wand2, AlertCircle, Copy, ScanLine, FileType2,
  FlaskConical, GitCompare, Crosshair, Star,
  TrendingUp, CalendarRange, FileText, Settings,
  HelpCircle, Plus, Zap, ChevronDown, ChevronUp
} from "lucide-react";

const MAIN_NAV = [
  { label: "Dashboard",    icon: LayoutDashboard, to: "/" },
  { label: "Data Overview",icon: Database,        to: "/overview" },
  { label: "Insights",     icon: Lightbulb,       to: "/insights" },
  { label: "Charts",       icon: BarChart2,       to: "/charts" },
  { label: "Ask Your Data",icon: MessageSquare,   to: "/query" },
];

const DATA_PREP = [
  { label: "Data Cleaning",          icon: Wand2,      to: "/prep/clean" },
  { label: "Missing Value Handling", icon: AlertCircle, to: "/prep/missing" },
  { label: "Duplicate Removal",      icon: Copy,       to: "/prep/duplicates" },
  { label: "Outlier Detection",      icon: ScanLine,   to: "/prep/outliers" },
  { label: "Data Type Fixes",        icon: FileType2,  to: "/prep/types" },
];

const ML_NAV = [
  { label: "Model Testing",     icon: FlaskConical, to: "/ml/testing" },
  { label: "Model Comparison",  icon: GitCompare,   to: "/ml/comparison" },
  { label: "Predictions",       icon: Crosshair,    to: "/ml/predictions" },
  { label: "Feature Importance",icon: Star,         to: "/ml/features" },
];

const FORECAST_NAV = [
  { label: "Future Predictions", icon: TrendingUp,    to: "/forecast/predict" },
  { label: "Scenario Analysis",  icon: CalendarRange, to: "/forecast/scenarios" },
];

const REPORTS_NAV = [
  { label: "Reports", icon: FileText, to: "/reports" },
];

const SECTIONS = [
  { key: "DATA PREPARATION", items: DATA_PREP },
  { key: "MACHINE LEARNING", items: ML_NAV },
  { key: "FORECASTING",      items: FORECAST_NAV },
  { key: "REPORTS",          items: REPORTS_NAV },
];

function NavItem({ label, icon: Icon, to, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      onClick={() => onNavigate && onNavigate()}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 16px",
        fontSize: 13,
        color: isActive ? "white" : "rgba(255,255,255,0.5)",
        background: isActive ? "#6B5FED" : "transparent",
        textDecoration: "none",
        fontWeight: isActive ? 600 : 400,
        transition: "all 0.15s",
        borderRadius: 0,
      })}
      onMouseEnter={e => {
        if (e.currentTarget.style.background !== "rgb(107, 95, 237)") {
          e.currentTarget.style.background = "#1E1B2E";
          e.currentTarget.style.color = "rgba(255,255,255,0.9)";
        }
      }}
      onMouseLeave={e => {
        if (e.currentTarget.style.background !== "rgb(107, 95, 237)") {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "rgba(255,255,255,0.5)";
        }
      }}
    >
      <Icon size={14} style={{ flexShrink: 0 }} />
      {label}
    </NavLink>
  );
}

export default function Sidebar({ mobileOpen, onClose }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState({
    "DATA PREPARATION": true,
    "MACHINE LEARNING": true,
    "FORECASTING": true,
    "REPORTS": true,
  });

  return (
    <>
    {mobileOpen && <div className="sidebar-overlay active" onClick={onClose} />}
    <aside className={`sidebar${mobileOpen ? " mobile-open" : ""}`} style={{
      width: 200,
      minHeight: "100vh",
      background: "#13111E",
      display: "flex",
      flexDirection: "column",
      position: "fixed",
      left: 0, top: 0, bottom: 0,
      zIndex: 50,
      overflowY: "auto",
      scrollbarWidth: "none",
    }}>
      {/* Logo */}
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 28, height: 28, background: "#6B5FED", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <BarChart2 size={15} color="white" />
        </div>
        <span style={{ color: "white", fontWeight: 700, fontSize: 16 }}>DataPilot</span>
      </div>

      {/* Upload button */}
      <div style={{ padding: "10px 12px" }}>
        <button
          onClick={() => { navigate("/"); onClose && onClose(); }}
          style={{ width: "100%", background: "#6B5FED", color: "white", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <Plus size={14} /> Upload Dataset
        </button>
      </div>

      {/* Main nav */}
      <nav style={{ flex: 1 }}>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600, letterSpacing: "0.7px", padding: "8px 16px 4px" }}>MAIN</p>
        {MAIN_NAV.map(item => <NavItem key={item.to} {...item} onNavigate={onClose} />)}

        {/* Collapsible sections */}
        {SECTIONS.map(({ key, items }) => (
          <div key={key}>
            <div
              onClick={() => setOpen(p => ({ ...p, [key]: !p[key] }))}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 4px", cursor: "pointer" }}
            >
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600, letterSpacing: "0.7px", margin: 0 }}>{key}</p>
              {open[key]
                ? <ChevronUp size={12} color="rgba(255,255,255,0.3)" />
                : <ChevronDown size={12} color="rgba(255,255,255,0.3)" />
              }
            </div>
            {open[key] && items.map(item => <NavItem key={item.to + item.label} {...item} onNavigate={onClose} />)}
          </div>
        ))}

        {/* Bottom links */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 8, paddingTop: 8 }}>
          <NavItem label="Settings"     icon={Settings}    to="/settings" onNavigate={onClose} />
          <NavItem label="Help & Support" icon={HelpCircle} to="/help" onNavigate={onClose} />
        </div>
      </nav>

      {/* Plan badge */}
      <PlanBadge />
    </aside>
    </>
  );
}

function PlanBadge() {
  const store = useStore();
  const { plan, limit, used, pct } = store.getPlanInfo();
  const tokenStatus = store.tokenStatus;
  const isStudent = plan === "student";

  useEffect(() => {
    if (isStudent) store.fetchTokenStatus();
  }, [isStudent]);

  const planLabel = {
    free: "Free Plan", basic: "Basic Plan", pro: "Pro Plan",
    student: "🎓 Student Plan",
    team: "Team Plan", business: "Business Plan", enterprise: "Enterprise Plan",
  }[plan] || "Free Plan";

  // Students are metered by daily actions (tokens), not dataset count —
  // 200/day if their email matched a verified college domain at signup,
  // 100/day otherwise. This comes from the backend (/api/auth/tokens)
  // since the daily reset logic lives there.
  let limitLabel, progressPct, showBar;
  if (isStudent) {
    if (tokenStatus && tokenStatus.is_student) {
      limitLabel = `${tokenStatus.tokens_used} / ${tokenStatus.tokens_limit} actions today`;
      progressPct = Math.min(100, Math.round((tokenStatus.tokens_used / tokenStatus.tokens_limit) * 100));
      showBar = true;
    } else {
      limitLabel = "Loading usage...";
      progressPct = 0;
      showBar = false;
    }
  } else {
    limitLabel = limit >= 999999 ? "Unlimited Datasets" : `${used} / ${limit} Datasets Used`;
    progressPct = pct;
    showBar = limit < 999999;
  }

  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 14px" }}>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 500, margin: "0 0 2px" }}>{planLabel}</p>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: "0 0 6px" }}>{limitLabel}</p>
      {showBar && (
        <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 4, height: 4, marginBottom: 8 }}>
          <div style={{ background: progressPct >= 90 ? "#EF4444" : "#6B5FED", height: 4, borderRadius: 4, width: `${progressPct}%` }} />
        </div>
      )}
      {plan !== "pro" && !isStudent && plan !== "team" && plan !== "business" && plan !== "enterprise" && (
        <button style={{ width: "100%", background: "rgba(107,95,237,0.2)", border: "1px solid rgba(107,95,237,0.4)", color: "#A89FF5", borderRadius: 8, padding: "7px", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Zap size={12} /> Upgrade Plan
        </button>
      )}
    </div>
  );
}
