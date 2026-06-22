import { useState, useEffect } from "react";
import { MessageSquare, Send, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { createAnnotation, listAnnotations, deleteAnnotation } from "../../api/client";
import toast from "react-hot-toast";

/**
 * Drop this on any chart/dataset/report to let users leave notes.
 * targetType: 'chart' | 'dataset' | 'report'
 * targetRef:  a stable string identifying the thing being commented on
 *             (e.g. chart title, dataset filename, report name)
 */
export default function CommentsPanel({ targetType, targetRef }) {
  const [open,     setOpen]     = useState(false);
  const [comments, setComments] = useState([]);
  const [text,     setText]     = useState("");
  const [loading,   setLoading]  = useState(false);
  const [posting,   setPosting]  = useState(false);

  useEffect(() => { if (open) loadComments(); }, [open, targetRef]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const res = await listAnnotations(targetType, targetRef);
      setComments(res.annotations || []);
    } catch (e) {
      // Likely no DB connection locally — fail quietly, comments are a nice-to-have
      setComments([]);
    } finally { setLoading(false); }
  };

  const handlePost = async () => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await createAnnotation(targetType, targetRef, text.trim());
      setText("");
      loadComments();
    } catch (e) {
      toast.error("Could not post comment — " + (e.response?.data?.detail || "is the backend/DB running?"));
    } finally { setPosting(false); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteAnnotation(id);
      setComments(c => c.filter(x => x.id !== id));
    } catch (e) { toast.error("Could not delete comment"); }
  };

  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", fontSize:12, color:"#6B5FED", padding:0 }}
      >
        <MessageSquare size={13} />
        {comments.length > 0 ? `${comments.length} comment${comments.length>1?"s":""}` : "Add a comment"}
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div style={{ marginTop: 10, background:"#FAFAFA", border:"1px solid #F3F4F6", borderRadius:8, padding:12 }}>
          {loading ? (
            <p style={{ fontSize:12, color:"#9CA3AF" }}>Loading comments...</p>
          ) : comments.length === 0 ? (
            <p style={{ fontSize:12, color:"#9CA3AF", marginBottom:10 }}>No comments yet — be the first to add context.</p>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:10 }}>
              {comments.map(c => (
                <div key={c.id} style={{ background:"white", border:"1px solid #E5E7EB", borderRadius:6, padding:"8px 10px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start" }}>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:11, fontWeight:600, color:"#374151", margin:"0 0 2px" }}>{c.author_name}</p>
                      <p style={{ fontSize:12, color:"#374151", margin:0, lineHeight:1.4 }}>{c.comment_text}</p>
                      <p style={{ fontSize:10, color:"#9CA3AF", margin:"4px 0 0" }}>{new Date(c.created_at).toLocaleString()}</p>
                    </div>
                    {c.is_mine && (
                      <button onClick={() => handleDelete(c.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#D1D5DB", flexShrink:0 }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display:"flex", gap:8 }}>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handlePost()}
              placeholder="Add a note (e.g. why this spike happened)..."
              style={{ flex:1, fontSize:12, padding:"6px 10px" }}
            />
            <button className="btn btn-primary btn-sm" onClick={handlePost} disabled={posting || !text.trim()}>
              <Send size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
