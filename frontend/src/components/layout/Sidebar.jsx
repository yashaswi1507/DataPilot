import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Database, BarChart2, Brain, TrendingUp,
  FileText, Settings, HelpCircle, ChevronDown, Zap, Upload
} from "lucide-react";
import clsx from "clsx";

const NAV = [
  { label: "Dashboard",       icon: LayoutDashboard, to: "/" },
  { label: "Data Overview",   icon: Database,        to: "/overview" },
  { label: "Insights",        icon: Zap,             to: "/insights" },
  { label: "Charts",          icon: BarChart2,       to: "/charts" },
  { label: "Ask Your Data",   icon: Brain,           to: "/query" },
];

const DATA_PREP = [
  { label: "Data Cleaning",          icon: Database,    to: "/prep/clean" },
  { label: "Missing Value Handling", icon: Database,    to: "/prep/missing" },
  { label: "Duplicate Removal",      icon: Database,    to: "/prep/duplicates" },
  { label: "Outlier Detection",      icon: Database,    to: "/prep/outliers" },
  { label: "Data Type Fixes",        icon: Database,    to: "/prep/types" },
];

const ML_NAV = [
  { label: "Model Testing",     icon: Brain,      to: "/ml/testing" },
  { label: "Model Comparison",  icon: BarChart2,  to: "/ml/comparison" },
  { label: "Predictions",       icon: Brain,      to: "/ml/predict" },
  { label: "Feature Importance",icon: BarChart2,  to: "/ml/features" },
];

const FORECAST_NAV = [
  { label: "Future Predictions", icon: TrendingUp, to: "/forecast/predict" },
  { label: "Scenario Analysis",  icon: TrendingUp, to: "/forecast/scenarios" },
];

const SidebarSection = ({ title, items, collapsed }) => (
  <div className="mb-2">
    <p className="px-3 py-1 text-xs font-semibold text-purple-300 uppercase tracking-wider">
      {title}
    </p>
    {items.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive }) =>
          clsx(
            "flex items-center gap-3 px-3 py-2 rounded-lg mx-2 text-sm transition-all",
            isActive
              ? "bg-purple-600 text-white font-medium"
              : "text-purple-200 hover:bg-purple-800/50 hover:text-white"
          )
        }
      >
        <item.icon size={15} />
        <span>{item.label}</span>
      </NavLink>
    ))}
  </div>
);

export default function Sidebar() {
  return (
    <aside className="w-52 min-h-screen bg-[#1E1B4B] flex flex-col fixed left-0 top-0 bottom-0 z-40">

      {/* Logo */}
      <div className="px-4 py-4 border-b border-purple-800/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
            <BarChart2 size={18} className="text-white" />
          </div>
          <span className="text-white font-bold text-lg">DataPilot</span>
        </div>
      </div>

      {/* Upload button */}
      <div className="px-3 py-3">
        <NavLink
          to="/"
          className="flex items-center justify-center gap-2 w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-all"
        >
          <Upload size={15} />
          Upload Dataset
        </NavLink>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-hide">

        <div className="mb-2">
          <p className="px-3 py-1 text-xs font-semibold text-purple-300 uppercase tracking-wider">
            Main
          </p>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg mx-2 text-sm transition-all",
                  isActive
                    ? "bg-purple-600 text-white font-medium"
                    : "text-purple-200 hover:bg-purple-800/50 hover:text-white"
                )
              }
            >
              <item.icon size={15} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        <SidebarSection title="Data Preparation" items={DATA_PREP} />
        <SidebarSection title="Machine Learning" items={ML_NAV} />
        <SidebarSection title="Forecasting" items={FORECAST_NAV} />

        <div className="mb-2">
          <p className="px-3 py-1 text-xs font-semibold text-purple-300 uppercase tracking-wider">
            Reports
          </p>
          <NavLink
            to="/reports"
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg mx-2 text-sm transition-all",
                isActive
                  ? "bg-purple-600 text-white font-medium"
                  : "text-purple-200 hover:bg-purple-800/50 hover:text-white"
              )
            }
          >
            <FileText size={15} />
            <span>Reports</span>
          </NavLink>
        </div>

        <div className="border-t border-purple-800/50 pt-2">
          <NavLink to="/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg mx-2 text-sm text-purple-200 hover:bg-purple-800/50 hover:text-white transition-all">
            <Settings size={15} />
            <span>Settings</span>
          </NavLink>
          <NavLink to="/help" className="flex items-center gap-3 px-3 py-2 rounded-lg mx-2 text-sm text-purple-200 hover:bg-purple-800/50 hover:text-white transition-all">
            <HelpCircle size={15} />
            <span>Help & Support</span>
          </NavLink>
        </div>
      </nav>

      {/* Bottom — plan info */}
      <div className="border-t border-purple-800/50 p-3">
        <div className="bg-purple-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 bg-blue-400 rounded flex items-center justify-center text-xs">🎓</div>
            <span className="text-white text-xs font-semibold">Free Plan</span>
          </div>
          <div className="mb-2">
            <div className="flex justify-between text-xs text-purple-300 mb-1">
              <span>5 / 10 Datasets Used</span>
            </div>
            <div className="w-full bg-purple-900 rounded-full h-1.5">
              <div className="bg-purple-400 h-1.5 rounded-full" style={{ width: "50%" }} />
            </div>
          </div>
          <button className="w-full py-1.5 bg-purple-500 hover:bg-purple-400 text-white text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1">
            <Zap size={12} />
            Upgrade Plan
          </button>
        </div>
      </div>
    </aside>
  );
}
