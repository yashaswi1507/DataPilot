import { useState, useEffect } from "react";
import { Save, Users, UserPlus, Trash2, X, Crown } from "lucide-react";
import toast from "react-hot-toast";
import { getMyOrganization, inviteMember, revokeInvite, removeMember, updateSeats } from "../api/client";
import useStore from "../store/useStore";

const SECTIONS = ["General","Preferences","Export Settings","Notifications","Account","Plan & Billing","Team","Security"];

export default function Settings() {
  const store = useStore();
  const [active, setActive]  = useState("General");
  const [theme,  setTheme]   = useState("Dark");
  const [lang,   setLang]    = useState("English");
  const [defPage,setDefPage] = useState("Dashboard");
  const [rows,   setRows]    = useState("25");
  const [dateF,  setDateF]   = useState("MM/DD/YYYY");
  const [timeZ,  setTimeZ]   = useState("(GMT+5:30) Mumbai, Kolkata");

  // Team/org state
  const [org,         setOrg]         = useState(null);
  const [orgLoading,  setOrgLoading]  = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting,    setInviting]    = useState(false);

  useEffect(() => {
    if (active === "Team") loadOrg();
  }, [active]);

  const loadOrg = async () => {
    setOrgLoading(true);
    try {
      const res = await getMyOrganization();
      setOrg(res.in_organization ? res : null);
    } catch (e) {
      setOrg(null);
    } finally { setOrgLoading(false); }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return toast.error("Enter an email address");
    setInviting(true);
    try {
      const res = await inviteMember(inviteEmail.trim());
      toast.success(res.message || "Invite sent!");
      setInviteEmail("");
      loadOrg();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not send invite");
    } finally { setInviting(false); }
  };

  const handleRevoke = async (id) => {
    try { await revokeInvite(id); toast.success("Invite revoked"); loadOrg(); }
    catch (e) { toast.error("Failed to revoke invite"); }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm("Remove this member from your organization?")) return;
    try { await removeMember(userId); toast.success("Member removed"); loadOrg(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed to remove member"); }
  };

  const handleSave = () => toast.success("Settings saved!");

  return (
    <div className="page">
      <div style={{ display:"grid", gridTemplateColumns:"220px 1fr", gap:20 }}>

        {/* Left nav */}
        <div className="card" style={{ padding:0, overflow:"hidden" }}>
          <p style={{ fontSize:11, fontWeight:600, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.5px", padding:"14px 16px 8px" }}>Settings</p>
          {SECTIONS.map(s => (
            <div key={s} onClick={() => setActive(s)}
              style={{
                padding:"10px 16px", fontSize:13, cursor:"pointer", transition:"all 0.15s",
                background: active===s ? "#F5F3FF" : "transparent",
                color:      active===s ? "#6B5FED" : "#374151",
                fontWeight: active===s ? 600 : 400,
                borderLeft: active===s ? "3px solid #6B5FED" : "3px solid transparent",
              }}>
              {s}
            </div>
          ))}
        </div>

        {/* Right content */}
        <div className="card">
          <h2 style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>{active}</h2>
          <p style={{ fontSize:13, color:"#9CA3AF", marginBottom:20 }}>Manage your {active.toLowerCase()} preferences</p>

          {active === "General" && (
            <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <div>
                  <label style={{ fontSize:13, fontWeight:500, display:"block", marginBottom:6 }}>Theme</label>
                  <div style={{ display:"flex", gap:8 }}>
                    {["Light","Dark","System"].map(t => (
                      <button key={t} onClick={() => setTheme(t)}
                        style={{ flex:1, padding:"8px", border:`1px solid ${theme===t?"#6B5FED":"#E5E7EB"}`, borderRadius:8, background:theme===t?"#EEF0FF":"white", color:theme===t?"#6B5FED":"#374151", fontSize:13, fontWeight:theme===t?600:400, cursor:"pointer" }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:13, fontWeight:500, display:"block", marginBottom:6 }}>Language</label>
                  <select value={lang} onChange={e => setLang(e.target.value)} style={{ width:"100%" }}>
                    <option>English</option><option>Hindi</option><option>Spanish</option>
                  </select>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <div>
                  <label style={{ fontSize:13, fontWeight:500, display:"block", marginBottom:6 }}>Default Page</label>
                  <select value={defPage} onChange={e => setDefPage(e.target.value)} style={{ width:"100%" }}>
                    <option>Dashboard</option><option>Analytics</option><option>Reports</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:13, fontWeight:500, display:"block", marginBottom:6 }}>Rows per page</label>
                  <select value={rows} onChange={e => setRows(e.target.value)} style={{ width:"100%" }}>
                    <option>10</option><option>25</option><option>50</option><option>100</option>
                  </select>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <div>
                  <label style={{ fontSize:13, fontWeight:500, display:"block", marginBottom:6 }}>Date Format</label>
                  <select value={dateF} onChange={e => setDateF(e.target.value)} style={{ width:"100%" }}>
                    <option>MM/DD/YYYY</option><option>DD/MM/YYYY</option><option>YYYY-MM-DD</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:13, fontWeight:500, display:"block", marginBottom:6 }}>Time Zone</label>
                  <select value={timeZ} onChange={e => setTimeZ(e.target.value)} style={{ width:"100%" }}>
                    <option>(GMT+5:30) Mumbai, Kolkata</option>
                    <option>(GMT+0:00) London</option>
                    <option>(GMT-5:00) New York</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {active === "Team" && (
            <div>
              {orgLoading ? (
                <p style={{ fontSize:13, color:"#9CA3AF" }}>Loading...</p>
              ) : !org ? (
                <div style={{ textAlign:"center", padding:"30px 0" }}>
                  <Users size={32} color="#D1D5DB" style={{ marginBottom:10 }} />
                  <p style={{ fontSize:14, color:"#6B7280", marginBottom:4 }}>You're not part of an organization yet.</p>
                  <p style={{ fontSize:12, color:"#9CA3AF" }}>Sign up for a Company/Team plan to invite teammates and manage seats.</p>
                </div>
              ) : (
                <>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, padding:"12px 16px", background:"#F5F3FF", borderRadius:8 }}>
                    <div>
                      <p style={{ fontSize:14, fontWeight:700, color:"#111827", margin:"0 0 2px" }}>{org.organization.name}</p>
                      <p style={{ fontSize:12, color:"#6B7280", margin:0 }}>{org.tier_info.label} plan · {org.seats_used}/{org.organization.seats_purchased} seats used</p>
                    </div>
                    {org.tier_info.price_per_seat && (
                      <p style={{ fontSize:13, fontWeight:600, color:"#6B5FED", margin:0 }}>₹{org.tier_info.price_per_seat}/seat/mo</p>
                    )}
                  </div>

                  {/* Invite form */}
                  <div style={{ display:"flex", gap:8, marginBottom:20 }}>
                    <input
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleInvite()}
                      placeholder="teammate@company.com"
                      style={{ flex:1, fontSize:13 }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={handleInvite} disabled={inviting || org.seats_available <= 0}>
                      <UserPlus size={13} /> {inviting ? "Sending..." : "Invite"}
                    </button>
                  </div>
                  {org.seats_available <= 0 && (
                    <p style={{ fontSize:11, color:"#EF4444", marginTop:-12, marginBottom:16 }}>No seats available — remove a member or purchase more seats.</p>
                  )}

                  {/* Members list */}
                  <p style={{ fontSize:12, fontWeight:600, color:"#374151", marginBottom:8 }}>Members ({org.members.length})</p>
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:20 }}>
                    {org.members.map(m => (
                      <div key={m.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", border:"1px solid #F3F4F6", borderRadius:8 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          {m.org_role === "admin" && <Crown size={13} color="#F59E0B" />}
                          <div>
                            <p style={{ fontSize:13, fontWeight:500, margin:0 }}>{m.name}</p>
                            <p style={{ fontSize:11, color:"#9CA3AF", margin:0 }}>{m.email}</p>
                          </div>
                        </div>
                        {m.org_role !== "admin" && (
                          <button onClick={() => handleRemoveMember(m.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#D1D5DB" }}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Pending invites */}
                  {org.pending_invites.length > 0 && (
                    <>
                      <p style={{ fontSize:12, fontWeight:600, color:"#374151", marginBottom:8 }}>Pending Invites ({org.pending_invites.length})</p>
                      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        {org.pending_invites.map(inv => (
                          <div key={inv.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", border:"1px solid #FDE68A", background:"#FFFBEB", borderRadius:8 }}>
                            <p style={{ fontSize:13, margin:0 }}>{inv.invited_email}</p>
                            <button onClick={() => handleRevoke(inv.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#D97706" }}>
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {active !== "General" && active !== "Team" && (
            <div style={{ textAlign:"center", padding:"40px 0", color:"#9CA3AF" }}>
              <p style={{ fontSize:14 }}>{active} settings coming soon.</p>
            </div>
          )}

          <div style={{ borderTop:"1px solid #F3F4F6", marginTop:24, paddingTop:16, display:"flex", justifyContent:"flex-end" }}>
            <button className="btn btn-primary" onClick={handleSave}><Save size={14} /> Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}
