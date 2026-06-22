import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, BarChart2, Mail, Lock, User, GraduationCap, Briefcase, Building2, ArrowLeft, Users } from "lucide-react";
import toast from "react-hot-toast";
import { register } from "../api/auth";
import { createOrganization } from "../api/client";
import useStore from "../store/useStore";

const STUDENT_DOMAIN_SUFFIXES = [".edu", ".ac.in", ".edu.in"];

const ORG_TIERS = {
  team:       { label: "Team",       minSeats: 2,  maxSeats: 10,  pricePerSeat: 399, custom: false, blurb: "For small teams getting started" },
  business:   { label: "Business",   minSeats: 11, maxSeats: 50,  pricePerSeat: 299, custom: false, blurb: "Better per-seat rate at scale" },
  enterprise: { label: "Enterprise", minSeats: 51, maxSeats: null,pricePerSeat: null,custom: true,  blurb: "Custom pricing, SSO, dedicated support" },
};

export default function Signup() {
  const navigate = useNavigate();
  const store    = useStore();

  // Step 1: account type selection — 'student' | 'individual' | 'company' | null
  const [accountType, setAccountType] = useState(null);

  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [plan,     setPlan]     = useState("free");

  // Company-specific fields
  const [orgName,  setOrgName]  = useState("");
  const [orgTier,  setOrgTier]  = useState("team");
  const [seats,    setSeats]    = useState(5);

  const isVerifiedStudentEmail = STUDENT_DOMAIN_SUFFIXES.some(s => email.toLowerCase().endsWith(s));
  const isStudentFlow  = accountType === "student";
  const isCompanyFlow  = accountType === "company";

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) return toast.error("Fill in all fields");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    if (isCompanyFlow && !orgName.trim()) return toast.error("Enter your company name");

    setLoading(true);
    try {
      const registerPlan = isStudentFlow ? "student" : isCompanyFlow ? orgTier : plan;
      const res = await register(name, email, password, registerPlan, isStudentFlow);
      store.setUser(res.user);
      store.setToken(res.token);
      localStorage.setItem("dp_token", res.token);
      localStorage.setItem("dp_user",  JSON.stringify(res.user));

      if (isCompanyFlow) {
        try {
          const orgRes = await createOrganization(orgName.trim(), orgTier, seats);
          toast.success(orgRes.message || "Organization created!");
        } catch (orgErr) {
          toast.error("Account created, but organization setup failed: " + (orgErr.response?.data?.detail || orgErr.message));
        }
      } else if (res.user.is_student) {
        toast.success(`Welcome, ${res.user.name}! Student plan activated 🎓`);
      } else {
        toast.success(`Welcome to DataPilot, ${res.user.name}!`);
      }
      navigate("/");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width:"100%", paddingLeft:38, paddingRight:14, paddingTop:10, paddingBottom:10, border:"1px solid #E5E7EB", borderRadius:8, fontSize:13, outline:"none", fontFamily:"Inter,sans-serif", boxSizing:"border-box" };

  return (
    <div style={{ minHeight:"100vh", background:"#F8F9FF", display:"flex" }}>

      {/* Left — branding */}
      <div style={{ width:"45%", background:"#13111E", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(circle at 25% 25%, rgba(107,95,237,0.15) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(107,95,237,0.1) 0%, transparent 50%)" }} />

        <div style={{ position:"relative", zIndex:1, textAlign:"center", maxWidth:360 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:48 }}>
            <div style={{ width:40, height:40, background:"#6B5FED", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <BarChart2 size={22} color="white" />
            </div>
            <span style={{ color:"white", fontWeight:700, fontSize:24, fontFamily:"Inter,sans-serif" }}>DataPilot</span>
          </div>

          <h1 style={{ color:"white", fontSize:28, fontWeight:700, marginBottom:14, fontFamily:"Inter,sans-serif", lineHeight:1.3 }}>Start Analysing Your Data Today</h1>
          <p style={{ color:"rgba(255,255,255,0.5)", fontSize:14, lineHeight:1.7, marginBottom:32 }}>
            Join 10,000+ analysts, students and business owners who use DataPilot to turn raw data into insights.
          </p>

          {accountType === null ? (
            <p style={{ fontSize:13, color:"rgba(255,255,255,0.35)" }}>Choose an account type to see your plan options →</p>
          ) : isStudentFlow ? (
            <div style={{ border:"1px solid #6B5FED", borderRadius:10, padding:"14px 16px", background:"rgba(107,95,237,0.15)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <span style={{ fontSize:18 }}>🎓</span>
                <span style={{ color:"white", fontSize:14, fontWeight:700 }}>Student Plan</span>
              </div>
              <p style={{ fontSize:11, color:"rgba(255,255,255,0.5)", margin:"0 0 8px" }}>
                Free access to everything — Pro-level features with a daily usage limit instead of a monthly price.
              </p>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                {[
                  isVerifiedStudentEmail ? "200 actions/day (verified)" : "100 actions/day",
                  "All ML models", "Unlimited datasets", "Resets every 24 hours",
                ].map(f => <span key={f} style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>✓ {f}</span>)}
              </div>
            </div>
          ) : isCompanyFlow ? (
            <div>
              <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:14 }}>
                {Object.entries(ORG_TIERS).map(([key, tier]) => (
                  <div key={key} onClick={() => setOrgTier(key)} style={{
                    border: `1px solid ${orgTier===key ? "#6B5FED" : "rgba(255,255,255,0.08)"}`,
                    borderRadius:10, padding:"12px 14px", cursor:"pointer", textAlign:"left",
                    background: orgTier===key ? "rgba(107,95,237,0.15)" : "rgba(255,255,255,0.03)",
                  }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <span style={{ color:"white", fontSize:13, fontWeight:600 }}>{tier.label}</span>
                      <span style={{ color:"#A89FF5", fontSize:12, fontWeight:600 }}>
                        {tier.custom ? "Custom pricing" : `₹${tier.pricePerSeat}/seat/mo`}
                      </span>
                    </div>
                    <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)", margin:0 }}>
                      {tier.label === "Enterprise" ? `${tier.minSeats}+ seats` : `${tier.minSeats}–${tier.maxSeats} seats`} · {tier.blurb}
                    </p>
                  </div>
                ))}
              </div>
              {!ORG_TIERS[orgTier].custom && (
                <div style={{ background:"rgba(107,95,237,0.1)", borderRadius:8, padding:"10px 12px", textAlign:"center" }}>
                  <p style={{ fontSize:11, color:"rgba(255,255,255,0.5)", margin:"0 0 2px" }}>Estimated monthly cost</p>
                  <p style={{ fontSize:18, fontWeight:700, color:"white", margin:0 }}>₹{(ORG_TIERS[orgTier].pricePerSeat * seats).toLocaleString()}</p>
                  <p style={{ fontSize:10, color:"rgba(255,255,255,0.35)", margin:0 }}>for {seats} seats</p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {[
                { id:"free",  label:"Free",  price:"₹0/month",   features:["10 datasets","Basic ML models","CSV/Excel support"] },
                { id:"basic", label:"Basic", price:"₹99/month",  features:["50 datasets","All ML models","Priority support"] },
                { id:"pro",   label:"Pro",   price:"₹499/month", features:["Unlimited datasets","API access","Team collaboration"] },
              ].map(p => (
                <div key={p.id} onClick={() => setPlan(p.id)} style={{
                  border: `1px solid ${plan===p.id ? "#6B5FED" : "rgba(255,255,255,0.08)"}`,
                  borderRadius:10, padding:"12px 14px", cursor:"pointer", textAlign:"left",
                  background: plan===p.id ? "rgba(107,95,237,0.15)" : "rgba(255,255,255,0.03)",
                  transition:"all 0.2s",
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                    <span style={{ color:"white", fontSize:13, fontWeight:600 }}>{p.label}</span>
                    <span style={{ color:"#A89FF5", fontSize:12, fontWeight:600 }}>{p.price}</span>
                  </div>
                  <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                    {p.features.map(f => (
                      <span key={f} style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>✓ {f}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right — form */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
        <div style={{ width:"100%", maxWidth:420 }}>

          {accountType === null ? (
            /* ── Step 1: Account type selection ──────────────── */
            <>
              <h2 style={{ fontSize:24, fontWeight:700, color:"#111827", marginBottom:6, fontFamily:"Inter,sans-serif" }}>Create your account</h2>
              <p style={{ fontSize:14, color:"#6B7280", marginBottom:28 }}>First, tell us who you are</p>

              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <button
                  onClick={() => setAccountType("student")}
                  style={{ display:"flex", alignItems:"center", gap:16, padding:"20px", border:"1.5px solid #E5E7EB", borderRadius:12, background:"white", cursor:"pointer", textAlign:"left", transition:"all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#6B5FED"; e.currentTarget.style.background = "#F5F3FF"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "white"; }}
                >
                  <div style={{ width:48, height:48, borderRadius:10, background:"#EEF0FF", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <GraduationCap size={24} color="#6B5FED" />
                  </div>
                  <div>
                    <p style={{ fontSize:16, fontWeight:700, color:"#111827", margin:"0 0 3px" }}>I'm a Student 🎓</p>
                    <p style={{ fontSize:12, color:"#6B7280", margin:0 }}>Free Pro-level access with a daily usage limit — no payment needed</p>
                  </div>
                </button>

                <button
                  onClick={() => setAccountType("individual")}
                  style={{ display:"flex", alignItems:"center", gap:16, padding:"20px", border:"1.5px solid #E5E7EB", borderRadius:12, background:"white", cursor:"pointer", textAlign:"left", transition:"all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#6B5FED"; e.currentTarget.style.background = "#F5F3FF"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "white"; }}
                >
                  <div style={{ width:48, height:48, borderRadius:10, background:"#EEF0FF", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <Briefcase size={24} color="#6B5FED" />
                  </div>
                  <div>
                    <p style={{ fontSize:16, fontWeight:700, color:"#111827", margin:"0 0 3px" }}>I'm an Individual 💼</p>
                    <p style={{ fontSize:12, color:"#6B7280", margin:0 }}>Choose from Free, Basic, or Pro plans</p>
                  </div>
                </button>

                <button
                  onClick={() => setAccountType("company")}
                  style={{ display:"flex", alignItems:"center", gap:16, padding:"20px", border:"1.5px solid #E5E7EB", borderRadius:12, background:"white", cursor:"pointer", textAlign:"left", transition:"all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#6B5FED"; e.currentTarget.style.background = "#F5F3FF"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "white"; }}
                >
                  <div style={{ width:48, height:48, borderRadius:10, background:"#EEF0FF", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <Users size={24} color="#6B5FED" />
                  </div>
                  <div>
                    <p style={{ fontSize:16, fontWeight:700, color:"#111827", margin:"0 0 3px" }}>I'm signing up my Company / Team 🏢</p>
                    <p style={{ fontSize:12, color:"#6B7280", margin:0 }}>Team, Business, or Enterprise plans with seat management</p>
                  </div>
                </button>
              </div>

              <p style={{ textAlign:"center", fontSize:13, color:"#6B7280", marginTop:28 }}>
                Already have an account?{" "}
                <Link to="/login" style={{ color:"#6B5FED", fontWeight:600, textDecoration:"none" }}>Sign in</Link>
              </p>
            </>
          ) : (
            /* ── Step 2: Account details form ────────────────── */
            <>
              <button
                onClick={() => setAccountType(null)}
                style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", color:"#6B7280", fontSize:13, padding:0, marginBottom:16 }}
              >
                <ArrowLeft size={14} /> Back
              </button>

              <h2 style={{ fontSize:24, fontWeight:700, color:"#111827", marginBottom:6, fontFamily:"Inter,sans-serif" }}>
                {isStudentFlow ? "Create your student account" : isCompanyFlow ? "Set up your company account" : "Create your account"}
              </h2>
              <p style={{ fontSize:14, color:"#6B7280", marginBottom:24 }}>
                {isStudentFlow ? "Use your college email if you have one — it unlocks higher daily limits" : isCompanyFlow ? "You'll be the admin — invite your team after signing up" : "Get started with DataPilot for free"}
              </p>

              <form onSubmit={handleSignup}>

                {isCompanyFlow && (
                  <>
                    <div style={{ marginBottom:14 }}>
                      <label style={{ fontSize:13, fontWeight:500, color:"#374151", display:"block", marginBottom:5 }}>Company Name</label>
                      <div style={{ position:"relative" }}>
                        <Building2 size={15} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }} />
                        <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Acme Inc." style={inputStyle}
                          onFocus={e => e.target.style.borderColor="#6B5FED"} onBlur={e => e.target.style.borderColor="#E5E7EB"} />
                      </div>
                    </div>

                    <div style={{ marginBottom:18 }}>
                      <label style={{ fontSize:13, fontWeight:500, color:"#374151", display:"block", marginBottom:5 }}>
                        Number of seats — <strong style={{ color:"#6B5FED" }}>{seats}</strong>
                      </label>
                      <input
                        type="range"
                        min={ORG_TIERS[orgTier].minSeats}
                        max={ORG_TIERS[orgTier].maxSeats || 200}
                        value={seats}
                        onChange={e => setSeats(Number(e.target.value))}
                        style={{ width:"100%" }}
                      />
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#9CA3AF" }}>
                        <span>{ORG_TIERS[orgTier].minSeats}</span>
                        <span>{ORG_TIERS[orgTier].maxSeats || "200+"}</span>
                      </div>
                      <p style={{ fontSize:11, color:"#6B7280", marginTop:6 }}>
                        Pick a tier on the left based on your team size — this sets the per-seat price.
                      </p>
                    </div>
                  </>
                )}

                {/* Name */}
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:13, fontWeight:500, color:"#374151", display:"block", marginBottom:5 }}>
                    {isCompanyFlow ? "Your Name (Admin)" : "Full Name"}
                  </label>
                  <div style={{ position:"relative" }}>
                    <User size={15} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }} />
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ankit Verma" style={inputStyle}
                      onFocus={e => e.target.style.borderColor="#6B5FED"} onBlur={e => e.target.style.borderColor="#E5E7EB"} />
                  </div>
                </div>

                {/* Email */}
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:13, fontWeight:500, color:"#374151", display:"block", marginBottom:5 }}>
                    {isStudentFlow ? "College / Personal Email" : "Email address"}
                  </label>
                  <div style={{ position:"relative" }}>
                    <Mail size={15} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }} />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle}
                      onFocus={e => e.target.style.borderColor="#6B5FED"} onBlur={e => e.target.style.borderColor="#E5E7EB"} />
                  </div>

                  {isStudentFlow && (
                    isVerifiedStudentEmail ? (
                      <div style={{ marginTop:8, background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:8, padding:"8px 12px", display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:16 }}>🎓</span>
                        <p style={{ fontSize:12, color:"#15803D", margin:0 }}>
                          <strong>Verified student email!</strong> You'll get 200 actions/day instead of 100.
                        </p>
                      </div>
                    ) : email.includes("@") && (
                      <div style={{ marginTop:8, background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:8, padding:"8px 12px" }}>
                        <p style={{ fontSize:12, color:"#92400E", margin:0, lineHeight:1.4 }}>
                          This isn't a recognized college domain (.edu / .ac.in) — you'll still get the Student Plan, just with a slightly lower daily limit (100/day instead of 200/day).
                        </p>
                      </div>
                    )
                  )}
                </div>

                {/* Password */}
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:13, fontWeight:500, color:"#374151", display:"block", marginBottom:5 }}>Password</label>
                  <div style={{ position:"relative" }}>
                    <Lock size={15} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }} />
                    <input type={showPass?"text":"password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters"
                      style={{ ...inputStyle, paddingRight:40 }}
                      onFocus={e => e.target.style.borderColor="#6B5FED"} onBlur={e => e.target.style.borderColor="#E5E7EB"} />
                    <button type="button" onClick={() => setShowPass(!showPass)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#9CA3AF", padding:0 }}>
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {password && (
                    <div style={{ marginTop:6 }}>
                      <div style={{ display:"flex", gap:4 }}>
                        {[...Array(4)].map((_,i) => (
                          <div key={i} style={{ flex:1, height:3, borderRadius:2, background: password.length > i*2+2 ? (password.length < 8 ? "#F59E0B" : "#22C55E") : "#E5E7EB" }} />
                        ))}
                      </div>
                      <p style={{ fontSize:11, color: password.length < 8 ? "#F59E0B" : "#22C55E", marginTop:3 }}>
                        {password.length < 8 ? "Too short" : password.length < 12 ? "Good" : "Strong"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div style={{ marginBottom:20 }}>
                  <label style={{ fontSize:13, fontWeight:500, color:"#374151", display:"block", marginBottom:5 }}>Confirm Password</label>
                  <div style={{ position:"relative" }}>
                    <Lock size={15} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }} />
                    <input type={showPass?"text":"password"} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password"
                      style={{ ...inputStyle, borderColor: confirm && confirm !== password ? "#EF4444" : "#E5E7EB" }}
                      onFocus={e => e.target.style.borderColor="#6B5FED"} onBlur={e => e.target.style.borderColor= confirm && confirm !== password ? "#EF4444" : "#E5E7EB"} />
                  </div>
                  {confirm && confirm !== password && <p style={{ fontSize:11, color:"#EF4444", marginTop:3 }}>Passwords do not match</p>}
                </div>

                {/* Submit */}
                <button type="submit" disabled={loading} style={{ width:"100%", background: loading?"#A89FF5":"#6B5FED", color:"white", border:"none", borderRadius:8, padding:"11px", fontSize:14, fontWeight:600, cursor: loading?"not-allowed":"pointer", fontFamily:"Inter,sans-serif", marginBottom:12 }}>
                  {loading ? "Creating account..." : "Create Account"}
                </button>

                <p style={{ fontSize:11, color:"#9CA3AF", textAlign:"center", lineHeight:1.6 }}>
                  By creating an account, you agree to our{" "}
                  <a href="#" style={{ color:"#6B5FED", textDecoration:"none" }}>Terms of Service</a>{" "}and{" "}
                  <a href="#" style={{ color:"#6B5FED", textDecoration:"none" }}>Privacy Policy</a>
                </p>
              </form>

              {/* Divider */}
              <div style={{ display:"flex", alignItems:"center", gap:12, margin:"18px 0" }}>
                <div style={{ flex:1, height:1, background:"#E5E7EB" }} />
                <span style={{ fontSize:12, color:"#9CA3AF" }}>or</span>
                <div style={{ flex:1, height:1, background:"#E5E7EB" }} />
              </div>

              {/* Google */}
              <button type="button" onClick={() => toast("Google signup coming soon!")} style={{ width:"100%", background:"white", border:"1px solid #E5E7EB", borderRadius:8, padding:"10px", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"Inter,sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:8, color:"#374151", marginBottom:10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              {/* Company email — UI only, no SSO wired yet */}
              <button
                type="button"
                onClick={() => toast("Company SSO coming soon — contact us to set this up for your team!")}
                style={{ width:"100%", background:"white", border:"1px solid #E5E7EB", borderRadius:8, padding:"10px", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"Inter,sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:8, color:"#374151" }}
              >
                <Building2 size={16} color="#6B7280" />
                Continue with Company Email
              </button>

              <p style={{ textAlign:"center", fontSize:13, color:"#6B7280", marginTop:20 }}>
                Already have an account?{" "}
                <Link to="/login" style={{ color:"#6B5FED", fontWeight:600, textDecoration:"none" }}>Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
