import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { User, Lock, Eye, EyeOff, BarChart2, Building2 } from "lucide-react";
import toast from "react-hot-toast";
import { acceptInvite } from "../api/auth";
import useStore from "../store/useStore";

export default function AcceptInvite() {
  const navigate = useNavigate();
  const store    = useStore();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [name,     setName]     = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return toast.error("Missing invite token");
    if (!name.trim()) return toast.error("Enter your name");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");

    setLoading(true);
    try {
      const res = await acceptInvite(token, name.trim(), password);
      store.setUser(res.user);
      store.setToken(res.token);
      localStorage.setItem("dp_token", res.token);
      localStorage.setItem("dp_user",  JSON.stringify(res.user));
      toast.success(`Welcome to the team, ${res.user.name}!`);
      navigate("/");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not accept invite. The link may have expired or already been used.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#F8F9FF", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:400, background:"white", borderRadius:14, padding:36, boxShadow:"0 4px 24px rgba(0,0,0,0.06)" }}>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:20 }}>
          <div style={{ width:32, height:32, background:"#6B5FED", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <BarChart2 size={17} color="white" />
          </div>
          <span style={{ fontWeight:700, fontSize:18 }}>DataPilot</span>
        </div>

        {!token ? (
          <div style={{ textAlign:"center" }}>
            <p style={{ fontSize:14, color:"#EF4444", marginBottom:16 }}>This invite link is missing a token. Please use the link from your invitation email exactly as sent.</p>
            <Link to="/login" style={{ color:"#6B5FED", fontWeight:600, fontSize:13 }}>Back to Login</Link>
          </div>
        ) : (
          <>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:8 }}>
              <Building2 size={18} color="#6B5FED" />
              <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>You've been invited!</h2>
            </div>
            <p style={{ fontSize:13, color:"#6B7280", marginBottom:22, textAlign:"center" }}>
              Set up your account to join the team.
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:13, fontWeight:500, color:"#374151", display:"block", marginBottom:5 }}>Full Name</label>
                <div style={{ position:"relative" }}>
                  <User size={15} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }} />
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    style={{ width:"100%", paddingLeft:38, paddingRight:14, paddingTop:10, paddingBottom:10, border:"1px solid #E5E7EB", borderRadius:8, fontSize:13, outline:"none", boxSizing:"border-box" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:13, fontWeight:500, color:"#374151", display:"block", marginBottom:5 }}>Create Password</label>
                <div style={{ position:"relative" }}>
                  <Lock size={15} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }} />
                  <input
                    type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
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
                <input
                  type={showPass ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  style={{ width:"100%", padding:"10px 14px", border:"1px solid #E5E7EB", borderRadius:8, fontSize:13, outline:"none", boxSizing:"border-box" }}
                />
                {confirm && confirm !== password && <p style={{ fontSize:11, color:"#EF4444", marginTop:4 }}>Passwords do not match</p>}
              </div>

              <button type="submit" disabled={loading} style={{ width:"100%", background: loading?"#A89FF5":"#6B5FED", color:"white", border:"none", borderRadius:8, padding:"11px", fontSize:14, fontWeight:600, cursor: loading?"not-allowed":"pointer" }}>
                {loading ? "Joining..." : "Join Team"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
