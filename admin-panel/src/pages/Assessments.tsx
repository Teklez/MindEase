import { useEffect, useState } from "react";
import { api, type AssessmentRow } from "../lib/api";
import CreateAssessmentDrawer from "../components/CreateAssessmentDrawer";

export default function Assessments() {
  const [rows, setRows] = useState<AssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.assessments();
    if (res.ok) setRows(res.data.assessments);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggle(r: AssessmentRow) {
    if (!confirm(`${r.is_active ? "Disable" : "Enable"} "${r.name}"?`)) return;
    const res = await api.updateAssessment(r.assessment_id, { is_active: !r.is_active });
    if (!res.ok) { alert("Update failed"); return; }
    load();
  }

  return (
    <div className="page" style={{ maxWidth: "100%" }}>
      <div className="page-header">
        <h2>Assessments</h2>
        <p>Mental health screening tools (GAD-7, PHQ-9, PSS)</p>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <span className="count">{rows.length.toLocaleString()} templates</span>
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ New assessment</button>
        </div>
        {loading ? (
          <div className="loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty">No assessments.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Questions</th>
                  <th>Time</th>
                  <th>Taken</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.assessment_id}>
                    <td style={{ fontWeight: 500 }}>{r.name}</td>
                    <td><span className="badge badge-muted">{r.assessment_type}</span></td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{r.question_count}</td>
                    <td style={{ color: "var(--muted-foreground)" }}>{r.estimated_time ?? "—"}</td>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--primary-deep)" }}>{r.times_taken.toLocaleString()}</td>
                    <td>
                      <span className={`badge ${r.is_active ? "badge-green" : "badge-red"}`}>
                        {r.is_active ? "active" : "disabled"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className={`btn btn-sm ${r.is_active ? "btn-danger" : "btn-primary"}`}
                        onClick={() => toggle(r)}
                      >
                        {r.is_active ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {creating && <CreateAssessmentDrawer onClose={() => setCreating(false)} onCreated={load} />}
    </div>
  );
}
