import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Lock, Eye, EyeOff, BarChart2, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { resetPassword } from "../api/auth";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return toast.error("Missing or invalid reset link");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");

    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      toast.success("Password reset! You can log in now.");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#F8F9FF", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:400, background:"white", borderRadius:14, padding:36, boxShadow:"0 4px 24px rgba(0,0,0,0.06)" }}>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:24 }}>
          <div style={{ width:32, height:32, background:"#6B5FED", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <BarChart2 size={17} color="white" />
          </div>
          <span style={{ fontWeight:700, fontSize:18 }}>DataPilot</span>
        </div>

        {!token ? (
          <div style={{ textAlign:"center" }}>
            <p style={{ fontSize:14, color:"#EF4444", marginBottom:16 }}>This reset link is missing a token. Please use the link from your email exactly as sent.</p>
            <Link to="/login" style={{ color:"#6B5FED", fontWeight:600, fontSize:13 }}>Back to Login</Link>
          </div>
        ) : done ? (
          <div style={{ textAlign:"center" }}>
            <CheckCircle size={40} color="#22C55E" style={{ marginBottom:12 }} />
            <h2 style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Password reset successful</h2>
            <p style={{ fontSize:13, color:"#6B7280", marginBottom:20 }}>You can now log in with your new password.</p>
            <button onClick={() => navigate("/login")} className="btn btn-primary" style={{ width:"100%", justifyContent:"center" }}>
              Go to Login
            </button>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize:18, fontWeight:700, marginBottom:4, textAlign:"center" }}>Choose a new password</h2>
            <p style={{ fontSize:13, color:"#6B7280", marginBottom:22, textAlign:"center" }}>Enter and confirm your new password below.</p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:13, fontWeight:500, color:"#374151", display:"block", marginBottom:5 }}>New Password</label>
                <div style={{ position:"relative" }}>
                  <Lock size={15} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }} />
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    style={{ width:"100%", paddingLeft:38, paddingRight:40, paddingTop:10, paddingBottom:10, border:"1px solid #E5E7EB", borderRadius:8, fontSize:13, outline:"none", boxSizing:"border-box" }}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#9CA3AF" }}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:13, fontWeight:500, color:"#374151", display:"block", marginBottom:5 }}>Confirm Password</label>
                <div style={{ position:"relative" }}>
                  <Lock size={15} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }} />
                  <input
                    type={showPass ? "text" : "password"}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    style={{ width:"100%", paddingLeft:38, paddingRight:14, paddingTop:10, paddingBottom:10, border:"1px solid #E5E7EB", borderRadius:8, fontSize:13, outline:"none", boxSizing:"border-box" }}
                  />
                </div>
                {confirm && confirm !== password && <p style={{ fontSize:11, color:"#EF4444", marginTop:4 }}>Passwords do not match</p>}
              </div>

              <button type="submit" disabled={loading} style={{ width:"100%", background: loading?"#A89FF5":"#6B5FED", color:"white", border:"none", borderRadius:8, padding:"11px", fontSize:14, fontWeight:600, cursor: loading?"not-allowed":"pointer" }}>
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>

            <p style={{ textAlign:"center", fontSize:13, color:"#6B7280", marginTop:20 }}>
              <Link to="/login" style={{ color:"#6B5FED", fontWeight:600, textDecoration:"none" }}>Back to Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
