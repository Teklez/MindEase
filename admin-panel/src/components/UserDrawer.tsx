import { useEffect, useState } from "react";
import { api, formatDate, type UserDetail } from "../lib/api";

type Props = {
  userId: string;
  onClose: () => void;
  onUpdated: () => void;
  selfUserId: string | null;
};

export default function UserDrawer({ userId, onClose, onUpdated, selfUserId }: Props) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.userDetail(userId).then((res) => {
      if (res.ok) setUser(res.data);
      setLoading(false);
    });
  }, [userId]);

  async function toggleStatus() {
    if (!user) return;
    const next = user.account_status === "active" ? "suspended" : "active";
    if (!confirm(`${next === "suspended" ? "Suspend" : "Activate"} ${user.email}?`)) return;
    const res = await api.updateUser(user.user_id, { account_status: next });
    if (!res.ok) { alert("Update failed"); return; }
    onUpdated();
    setUser({ ...user, account_status: next });
  }

  async function toggleAdmin() {
    if (!user) return;
    const next = !user.is_admin;
    if (!confirm(`${next ? "Grant" : "Revoke"} admin for ${user.email}?`)) return;
    const res = await api.updateUser(user.user_id, { is_admin: next });
    if (!res.ok) { alert("Update failed"); return; }
    onUpdated();
    setUser({ ...user, is_admin: next });
  }

  async function clearMemory() {
    if (!user) return;
    if (!confirm(`Clear all AI memory for ${user.email}? This deletes their personal context — irreversible.`)) return;
    const res = await api.clearUserMemory(user.user_id);
    if (!res.ok) { alert("Clear failed"); return; }
    alert(`Cleared ${"deleted_rows" in res.data ? res.data.deleted_rows : 0} memory chunks.`);
  }

  async function deleteAccount() {
    if (!user) return;
    const text = prompt(`This will permanently delete ${user.email} and ALL their data (conversations, mood entries, assessments). Type DELETE to confirm.`);
    if (text !== "DELETE") return;
    const res = await api.deleteUser(user.user_id);
    if (!res.ok) { alert("Delete failed"); return; }
    onUpdated();
    onClose();
  }

  const isSelf = user?.user_id === selfUserId;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal>
        <header className="drawer-header">
          <div>
            <h3>{user?.display_name ?? "Loading…"}</h3>
            {user && <div className="subtitle">{user.email}</div>}
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="drawer-body">
          {loading || !user ? (
            <div className="loading">Loading…</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                <span className={`badge ${user.account_status === "active" ? "badge-green" : "badge-red"}`}>{user.account_status}</span>
                {user.is_admin && <span className="badge badge-yellow">admin</span>}
                {user.is_verified && <span className="badge badge-blue">verified</span>}
                {user.oauth_provider && <span className="badge badge-muted">{user.oauth_provider}</span>}
              </div>

              <div className="detail-grid">
                <div className="detail-item">
                  <div className="label">Conversations</div>
                  <div className="value">{user.stats.conversations.toLocaleString()}</div>
                </div>
                <div className="detail-item">
                  <div className="label">Mood entries</div>
                  <div className="value">{user.stats.mood_entries.toLocaleString()}</div>
                </div>
                <div className="detail-item">
                  <div className="label">Assessments</div>
                  <div className="value">{user.stats.assessments.toLocaleString()}</div>
                </div>
                <div className="detail-item">
                  <div className="label">Avg mood</div>
                  <div className="value">{user.stats.avg_mood != null ? user.stats.avg_mood.toFixed(1) : "—"}</div>
                </div>
              </div>

              {user.stats.crisis_conversations > 0 && (
                <div style={{
                  background: "var(--destructive-soft)", border: "1px solid var(--destructive)",
                  borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 18,
                  color: "var(--destructive-deep)", fontSize: 13
                }}>
                  ⚠ {user.stats.crisis_conversations} crisis-flagged conversation{user.stats.crisis_conversations === 1 ? "" : "s"}
                </div>
              )}

              <div style={{ marginBottom: 24 }}>
                <div className="detail-row"><span className="key">User ID</span><span className="val" style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{user.user_id.slice(0, 18)}…</span></div>
                <div className="detail-row"><span className="key">Joined</span><span className="val">{formatDate(user.created_at)}</span></div>
                <div className="detail-row"><span className="key">Last login</span><span className="val">{formatDate(user.last_login)}</span></div>
                <div className="detail-row"><span className="key">Auth method</span><span className="val">{user.oauth_provider ?? "password"}</span></div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-ghost" onClick={toggleAdmin} disabled={isSelf}>
                  {user.is_admin ? "Revoke admin" : "Make admin"}
                </button>
                <button
                  className={`btn ${user.account_status === "active" ? "btn-danger" : "btn-primary"}`}
                  onClick={toggleStatus}
                  disabled={isSelf}
                >
                  {user.account_status === "active" ? "Suspend" : "Activate"}
                </button>
              </div>
              <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px dashed var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                  Danger zone
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost btn-sm" onClick={clearMemory} disabled={isSelf}>
                    Clear AI memory
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={deleteAccount} disabled={isSelf}>
                    Delete account
                  </button>
                </div>
              </div>
              {isSelf && <p style={{ marginTop: 10, fontSize: 11.5, color: "var(--muted-foreground)" }}>You can't modify your own admin account.</p>}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
