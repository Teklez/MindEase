import { useEffect, useState } from "react";
import { api, type BadgeRow } from "../lib/api";
import CreateBadgeDrawer from "../components/CreateBadgeDrawer";

export default function Badges() {
  const [rows, setRows] = useState<BadgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.badges();
    if (res.ok) setRows(res.data.badges);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggle(b: BadgeRow) {
    if (!confirm(`${b.is_active ? "Disable" : "Enable"} "${b.name}"?`)) return;
    const res = await api.updateBadge(b.badge_id, { is_active: !b.is_active });
    if (!res.ok) { alert("Update failed"); return; }
    load();
  }

  return (
    <div className="page" style={{ maxWidth: "100%" }}>
      <div className="page-header">
        <h2>Badges</h2>
        <p>Achievement badges users can earn</p>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <span className="count">{rows.length.toLocaleString()} badges</span>
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ New badge</button>
        </div>
        {loading ? (
          <div className="loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty">No badges.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Criteria</th>
                  <th>Earned</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.badge_id}>
                    <td style={{ fontWeight: 500 }}>{b.name}</td>
                    <td style={{ color: "var(--muted-foreground)", maxWidth: 360 }}>{b.description}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{b.criteria_type} ≥ {b.criteria_value}</td>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--primary-deep)" }}>{b.times_earned.toLocaleString()}</td>
                    <td>
                      <span className={`badge ${b.is_active ? "badge-green" : "badge-red"}`}>
                        {b.is_active ? "active" : "disabled"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className={`btn btn-sm ${b.is_active ? "btn-danger" : "btn-primary"}`}
                        onClick={() => toggle(b)}
                      >
                        {b.is_active ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {creating && <CreateBadgeDrawer onClose={() => setCreating(false)} onCreated={load} />}
    </div>
  );
}
