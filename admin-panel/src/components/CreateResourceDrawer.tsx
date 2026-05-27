import { useState, FormEvent } from "react";
import { api } from "../lib/api";

type Props = { onClose: () => void; onCreated: () => void };

const TYPES = ["article", "video", "audio", "exercise"];
const CATEGORIES = [
  "anxiety", "depression", "stress", "sleep", "mindfulness",
  "self_esteem", "relationships", "trauma",
];

export default function CreateResourceDrawer({ onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resourceType, setResourceType] = useState("article");
  const [category, setCategory] = useState("anxiety");
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await api.createResource({
      title, description, resource_type: resourceType, category, url,
      duration: duration || undefined,
      thumbnail_url: thumbnail || undefined,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || "Create failed");
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" style={{ width: 480 }} role="dialog" aria-modal>
        <header className="drawer-header">
          <div>
            <h3>New resource</h3>
            <div className="subtitle">Add a wellness article, video, or exercise</div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <form className="drawer-body" onSubmit={submit}>
          <div className="form-group">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select value={resourceType} onChange={(e) => setResourceType(e.target.value)}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>URL</label>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Duration (optional)</label>
              <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 8 min" />
            </div>
            <div className="form-group">
              <label>Thumbnail URL (optional)</label>
              <input type="url" value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          {error && <div className="error-msg" style={{ marginTop: 0 }}>{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create resource"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
