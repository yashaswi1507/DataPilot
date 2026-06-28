import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { Toaster } from "react-hot-toast";
import Sidebar       from "./components/layout/Sidebar";
import Topbar        from "./components/layout/Topbar";
import Dashboard     from "./pages/Dashboard";
import Overview      from "./pages/Overview";
import Analytics     from "./pages/Analytics";
import Charts        from "./pages/Charts";
import DataPrep      from "./pages/DataPrep";
import MissingValues from "./pages/MissingValues";
import Duplicates    from "./pages/Duplicates";
import DataTypes     from "./pages/DataTypes";
import Advanced       from "./pages/Advanced";
import MLPage        from "./pages/ML";
import Forecast      from "./pages/Forecast";
import Query         from "./pages/Query";
import Reports       from "./pages/Reports";
import Settings      from "./pages/Settings";
import Login         from "./pages/Login";
import Signup        from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import AcceptInvite  from "./pages/AcceptInvite";

function Guard({ children }) {
  return localStorage.getItem("dp_token") ? children : <Navigate to="/login" replace />;
}
function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="main-content">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        {children}
      </div>
    </>
  );
}
const P = ({ page: Page }) => <Guard><Layout><Page /></Layout></Guard>;
const Placeholder = ({ t }) => (
  <div className="page" style={{ textAlign:"center", paddingTop:80 }}>
    <p style={{ fontSize:24, marginBottom:12 }}>🚧</p>
    <p style={{ fontSize:15, color:"#9CA3AF" }}>{t} — Coming soon</p>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration:3000, style:{ fontSize:13 } }} />
      <Routes>
        <Route path="/login"  element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/accept-invite"  element={<AcceptInvite />} />
        <Route path="/"                   element={<P page={Dashboard} />} />
        <Route path="/overview"           element={<P page={Overview} />} />
        <Route path="/insights"           element={<P page={Analytics} />} />
        <Route path="/charts"             element={<P page={Charts} />} />
        <Route path="/query"              element={<P page={Query} />} />
        <Route path="/prep/clean"         element={<P page={DataPrep} />} />
        <Route path="/prep/missing"       element={<P page={MissingValues} />} />
        <Route path="/prep/duplicates"    element={<P page={Duplicates} />} />
        <Route path="/prep/outliers"      element={<P page={Advanced} />} />
        <Route path="/prep/types"         element={<P page={DataTypes} />} />
        <Route path="/ml/testing"         element={<P page={MLPage} />} />
        <Route path="/ml/comparison"      element={<P page={MLPage} />} />
        <Route path="/ml/predictions"     element={<P page={MLPage} />} />
        <Route path="/ml/features"        element={<P page={MLPage} />} />
        <Route path="/forecast/predict"   element={<P page={Forecast} />} />
        <Route path="/forecast/scenarios" element={<P page={Advanced} />} />
        <Route path="/reports"            element={<P page={Reports} />} />
        <Route path="/settings"           element={<P page={Settings} />} />
        <Route path="/help"               element={<Guard><Layout><Placeholder t="Help & Support" /></Layout></Guard>} />
        <Route path="*"                   element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
