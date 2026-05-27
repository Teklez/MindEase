import { useState, FormEvent } from "react";
import { api } from "../lib/api";

type Props = { onClose: () => void; onCreated: () => void };

const SCALE_PRESETS: Record<string, { value: number; label: string }[]> = {
  likert_0_3: [
    { value: 0, label: "Not at all" },
    { value: 1, label: "Several days" },
    { value: 2, label: "More than half the days" },
    { value: 3, label: "Nearly every day" },
  ],
  likert_0_4: [
    { value: 0, label: "Never" },
    { value: 1, label: "Almost never" },
    { value: 2, label: "Sometimes" },
    { value: 3, label: "Fairly often" },
    { value: 4, label: "Very often" },
  ],
  likert_1_5: [
    { value: 1, label: "Strongly disagree" },
    { value: 2, label: "Disagree" },
    { value: 3, label: "Neutral" },
    { value: 4, label: "Agree" },
    { value: 5, label: "Strongly agree" },
  ],
};

type Spec = {
  name: string;
  description: string;
  assessment_type: string;
  icon?: string;
  estimated_time?: string;
  response_scale: "likert_0_3" | "likert_0_4" | "likert_1_5";
  questions: string[];
  ranges: { min: number; max: number; level: string; label: string; feedback: string }[];
};

export default function CreateAssessmentDrawer({ onClose, onCreated }: Props) {
  const [prompt, setPrompt] = useState("");
  const [spec, setSpec] = useState<Spec | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    if (!prompt.trim()) { setError("Describe the assessment first."); return; }
    setError("");
    setSpec(null);
    setGenerating(true);
    const res = await api.generateAssessment(prompt.trim());
    setGenerating(false);
    if (!res.ok) {
      setError(res.error || "AI generation failed. Try again in a moment.");
      return;
    }
    if (res.data.refusal) {
      setError(`The AI declined this request: ${res.data.refusal}`);
      return;
    }
    const s = res.data.spec as Spec | undefined;
    if (!s || !s.questions?.length || !s.ranges?.length) {
      setError("AI returned an incomplete result. Try a more specific prompt.");
      return;
    }
    if (!SCALE_PRESETS[s.response_scale]) s.response_scale = "likert_0_3";
    setSpec(s);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!spec) return;
    setSaving(true);
    setError("");
    const res = await api.createAssessment({
      name: spec.name,
      description: spec.description,
      assessment_type: spec.assessment_type,
      icon: spec.icon || "📋",
      estimated_time: spec.estimated_time || null,
      questions: spec.questions,
      response_options: SCALE_PRESETS[spec.response_scale],
      ranges: spec.ranges,
    });
    setSaving(false);
    if (!res.ok) { setError(res.error || "Save failed"); return; }
    onCreated();
    onClose();
  }

  function updateSpec<K extends keyof Spec>(key: K, value: Spec[K]) {
    if (!spec) return;
    setSpec({ ...spec, [key]: value });
  }

  const options = spec ? SCALE_PRESETS[spec.response_scale] : null;
  const maxScore = spec && options ? options[options.length - 1].value * spec.questions.length : 0;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" style={{ width: 580 }} role="dialog" aria-modal>
        <header className="drawer-header">
          <div>
            <h3>New assessment</h3>
            <div className="subtitle">Describe what to measure — AI drafts the rest</div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="drawer-body" onSubmit={save}>
          <div className="ai-card">
            <div className="ai-card-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z" />
              </svg>
              <span>Describe the assessment</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A 7-question sleep quality screening for adults with insomnia symptoms"
              rows={2}
              className="ai-card-input"
            />
            <div className="ai-card-actions">
              <span className="ai-card-hint">
                {generating ? "Drafting with Gemini…" : spec ? "Review and edit anything below, then save." : ""}
              </span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={generate}
                disabled={generating || !prompt.trim()}
              >
                {generating ? "Generating…" : spec ? "Regenerate" : "Generate"}
              </button>
            </div>
          </div>

          {!spec && !generating && (
            <div className="empty" style={{ paddingTop: 24 }}>
              Enter a brief above to draft the assessment.
            </div>
          )}

          {spec && (
            <>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Name</label>
                  <input value={spec.name} onChange={(e) => updateSpec("name", e.target.value)} required />
                </div>
                <div className="form-group" style={{ maxWidth: 80 }}>
                  <label>Icon</label>
                  <input value={spec.icon || ""} onChange={(e) => updateSpec("icon", e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={spec.description} onChange={(e) => updateSpec("description", e.target.value)} rows={2} />
              </div>

              <div className="preview-section">
                <div className="preview-row">
                  <span className="preview-label">Category</span>
                  <span className="badge badge-green" style={{ textTransform: "lowercase" }}>{spec.assessment_type}</span>
                </div>
                <div className="preview-row">
                  <span className="preview-label">Response scale</span>
                  <span className="preview-value">{spec.response_scale.replace("likert_", "").replace("_", "–")}</span>
                </div>
                <div className="preview-row">
                  <span className="preview-label">Time estimate</span>
                  <span className="preview-value">{spec.estimated_time ?? "—"}</span>
                </div>
                <div className="preview-row">
                  <span className="preview-label">Max score</span>
                  <span className="preview-value">{maxScore}</span>
                </div>
              </div>

              {options && (
                <div className="form-section">
                  <div className="form-section-title">
                    <span>Response options · {options.length}</span>
                  </div>
                  <div className="option-chips">
                    {options.map((o) => (
                      <span key={o.value} className="option-chip">
                        <span className="option-chip-value">{o.value}</span>
                        <span>{o.label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-section">
                <div className="form-section-title">
                  <span>Questions · {spec.questions.length}</span>
                </div>
                {spec.questions.map((q, i) => (
                  <div key={i} className="preview-item">
                    <span className="preview-index">{i + 1}.</span>
                    <span>{q}</span>
                  </div>
                ))}
              </div>

              <div className="form-section">
                <div className="form-section-title">
                  <span>Scoring tiers</span>
                </div>
                {spec.ranges.map((r, i) => (
                  <div key={i} className="range-card">
                    <div className="range-card-header">
                      <span className="badge badge-green">{r.level}</span>
                      <span className="range-card-score">{r.min}–{r.max}</span>
                      <span className="range-card-label">{r.label}</span>
                    </div>
                    <div className="range-card-feedback">{r.feedback}</div>
                  </div>
                ))}
              </div>

              {error && <div className="error-msg" style={{ marginTop: 0 }}>{error}</div>}

              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save assessment"}
                </button>
              </div>
            </>
          )}

          {!spec && error && <div className="error-msg" style={{ marginTop: 14 }}>{error}</div>}
        </form>
      </aside>
    </>
  );
}
