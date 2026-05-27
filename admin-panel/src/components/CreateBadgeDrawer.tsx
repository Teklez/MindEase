import { useState, FormEvent } from "react";
import { api } from "../lib/api";

type Props = { onClose: () => void; onCreated: () => void };

const CRITERIA: { value: string; label: string; hint: string; defaultValue: number }[] = [
  { value: "mood_count", label: "Mood entries", hint: "Total mood entries logged", defaultValue: 10 },
  { value: "mood_streak", label: "Mood streak", hint: "Consecutive days of mood logging", defaultValue: 7 },
  { value: "chat_count", label: "Chat conversations", hint: "Total AI conversations started", defaultValue: 5 },
  { value: "resource_view", label: "Resources viewed", hint: "Different resources opened", defaultValue: 5 },
  { value: "assessment", label: "Assessments taken", hint: "Self-check screenings completed", defaultValue: 3 },
];

export default function CreateBadgeDrawer({ onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🏅");
  const [criteriaType, setCriteriaType] = useState(CRITERIA[0].value);
  const [criteriaValue, setCriteriaValue] = useState(CRITERIA[0].defaultValue);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const current = CRITERIA.find((c) => c.value === criteriaType) ?? CRITERIA[0];

  function pickCriteria(value: string) {
    const c = CRITERIA.find((x) => x.value === value);
    setCriteriaType(value);
    if (c) setCriteriaValue(c.defaultValue);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (criteriaValue < 1) { setError("Threshold must be at least 1."); return; }
    setSubmitting(true);
    const res = await api.createBadge({
      name: name.trim(),
      description: description.trim(),
      icon: icon.trim() || "🏅",
      criteria_type: criteriaType,
      criteria_value: criteriaValue,
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
      <aside className="drawer" style={{ width: 460 }} role="dialog" aria-modal>
        <header className="drawer-header">
          <div>
            <h3>New badge</h3>
            <div className="subtitle">Reward users for meaningful engagement</div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <form className="drawer-body" onSubmit={submit}>
          <div className="form-row" style={{ alignItems: "end" }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Week of Reflection" required />
            </div>
            <div className="form-group" style={{ maxWidth: 80 }}>
              <label>Icon</label>
              <input value={icon} onChange={(e) => setIcon(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What the user did to earn this." required />
          </div>

          <div className="form-section">
            <div className="form-section-title">
              <span>Earning criteria</span>
            </div>
            <div className="form-group">
              <label>When the user reaches</label>
              <select value={criteriaType} onChange={(e) => pickCriteria(e.target.value)}>
                {CRITERIA.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 6, lineHeight: 1.5 }}>
                {current.hint}
              </div>
            </div>
            <div className="form-group">
              <label>Threshold</label>
              <input
                type="number"
                min={1}
                value={criteriaValue}
                onChange={(e) => setCriteriaValue(parseInt(e.target.value, 10) || 0)}
                required
              />
            </div>
            <div style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              fontSize: 12.5,
              color: "var(--muted-foreground)",
              lineHeight: 1.5,
            }}>
              <span style={{ fontFamily: "var(--font-serif)", color: "var(--foreground)", fontWeight: 500 }}>{icon} {name || "Badge"}</span>
              {" — "}awarded when a user reaches <strong>{criteriaValue}</strong> {current.label.toLowerCase()}.
            </div>
          </div>

          {error && <div className="error-msg" style={{ marginTop: 0 }}>{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create badge"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
