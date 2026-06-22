import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, BarChart2, Mail, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { login } from "../api/auth";
import useStore from "../store/useStore";

export default function Login() {
  const navigate = useNavigate();
  const store    = useStore();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Fill in all fields");
    setLoading(true);
    try {
      const res = await login(email, password);
      store.setUser(res.user);
      store.setToken(res.token);
      localStorage.setItem("dp_token", res.token);
      localStorage.setItem("dp_user",  JSON.stringify(res.user));
      toast.success(`Welcome back, ${res.user.name}!`);
      navigate("/");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#F8F9FF", display:"flex" }}>

      {/* Left — branding */}
      <div className="auth-brand-panel" style={{ width:"45%", background:"#13111E", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px", position:"relative", overflow:"hidden" }}>

        {/* Background pattern */}
        <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(circle at 25% 25%, rgba(107,95,237,0.15) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(107,95,237,0.1) 0%, transparent 50%)" }} />

        <div style={{ position:"relative", zIndex:1, textAlign:"center", maxWidth:360 }}>
          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:48 }}>
            <div style={{ width:40, height:40, background:"#6B5FED", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <BarChart2 size={22} color="white" />
            </div>
            <span style={{ color:"white", fontWeight:700, fontSize:24, fontFamily:"Inter,sans-serif" }}>DataPilot</span>
          </div>

          <h1 style={{ color:"white", fontSize:28, fontWeight:700, marginBottom:14, fontFamily:"Inter,sans-serif", lineHeight:1.3 }}>
            Turn Your Data Into Powerful Insights
          </h1>
          <p style={{ color:"rgba(255,255,255,0.5)", fontSize:14, lineHeight:1.7, marginBottom:40 }}>
            Upload any dataset, auto-clean it, visualize trends, run ML predictions and export beautiful reports — all in one place.
          </p>

          {/* Features list */}
          {["AI-Powered Auto Cleaning","Machine Learning Studio","Time Series Forecasting","Natural Language Queries","Professional Reports"].map(f => (
            <div key={f} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, textAlign:"left" }}>
              <div style={{ width:20, height:20, borderRadius:"50%", background:"rgba(107,95,237,0.3)", border:"1px solid #6B5FED", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span style={{ color:"#A89FF5", fontSize:11 }}>✓</span>
              </div>
              <span style={{ color:"rgba(255,255,255,0.65)", fontSize:13 }}>{f}</span>
            </div>
          ))}

          {/* Stats */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginTop:40, paddingTop:32, borderTop:"1px solid rgba(255,255,255,0.08)" }}>
            {[["10K+","Users"],["50K+","Datasets"],["4.8★","Rating"]].map(([val,label]) => (
              <div key={label} style={{ textAlign:"center" }}>
                <p style={{ color:"white", fontSize:20, fontWeight:700, margin:"0 0 2px" }}>{val}</p>
                <p style={{ color:"rgba(255,255,255,0.4)", fontSize:11 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="auth-form-panel" style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
        <div style={{ width:"100%", maxWidth:400 }}>

          <h2 style={{ fontSize:24, fontWeight:700, color:"#111827", marginBottom:6, fontFamily:"Inter,sans-serif" }}>Welcome back</h2>
          <p style={{ fontSize:14, color:"#6B7280", marginBottom:28 }}>Sign in to your DataPilot account</p>

          <form onSubmit={handleLogin}>

            {/* Email */}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:13, fontWeight:500, color:"#374151", display:"block", marginBottom:6 }}>Email address</label>
              <div style={{ position:"relative" }}>
                <Mail size={15} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ width:"100%", paddingLeft:38, paddingRight:14, paddingTop:10, paddingBottom:10, border:"1px solid #E5E7EB", borderRadius:8, fontSize:13, outline:"none", fontFamily:"Inter,sans-serif", boxSizing:"border-box" }}
                  onFocus={e => e.target.style.borderColor = "#6B5FED"}
                  onBlur={e => e.target.style.borderColor = "#E5E7EB"}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <label style={{ fontSize:13, fontWeight:500, color:"#374151" }}>Password</label>
                <a href="#" style={{ fontSize:13, color:"#6B5FED", textDecoration:"none" }}>Forgot password?</a>
              </div>
              <div style={{ position:"relative" }}>
                <Lock size={15} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }} />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  style={{ width:"100%", paddingLeft:38, paddingRight:40, paddingTop:10, paddingBottom:10, border:"1px solid #E5E7EB", borderRadius:8, fontSize:13, outline:"none", fontFamily:"Inter,sans-serif", boxSizing:"border-box" }}
                  onFocus={e => e.target.style.borderColor = "#6B5FED"}
                  onBlur={e => e.target.style.borderColor = "#E5E7EB"}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#9CA3AF", padding:0 }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{ width:"100%", background: loading ? "#A89FF5" : "#6B5FED", color:"white", border:"none", borderRadius:8, padding:"11px", fontSize:14, fontWeight:600, cursor: loading ? "not-allowed" : "pointer", fontFamily:"Inter,sans-serif", transition:"background 0.2s" }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display:"flex", alignItems:"center", gap:12, margin:"20px 0" }}>
            <div style={{ flex:1, height:1, background:"#E5E7EB" }} />
            <span style={{ fontSize:12, color:"#9CA3AF" }}>or continue with</span>
            <div style={{ flex:1, height:1, background:"#E5E7EB" }} />
          </div>

          {/* Google (optional) */}
          <button
            type="button"
            onClick={() => toast("Google login coming soon!")}
            style={{ width:"100%", background:"white", border:"1px solid #E5E7EB", borderRadius:8, padding:"10px", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"Inter,sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:8, color:"#374151" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Sign up link */}
          <p style={{ textAlign:"center", fontSize:13, color:"#6B7280", marginTop:24 }}>
            Don't have an account?{" "}
            <Link to="/signup" style={{ color:"#6B5FED", fontWeight:600, textDecoration:"none" }}>Sign up for free</Link>
          </p>

          <p style={{ textAlign:"center", fontSize:11, color:"#9CA3AF", marginTop:20 }}>
            © 2025 DataPilot. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
