import { useEffect, useState } from "react";
import { api, type GroupMemberRow } from "../lib/api";
import { useConfirm, useToast } from "./UI";

type Props = {
  groupId: string;
  groupName: string;
  onClose: () => void;
  onChanged?: () => void;
};

export default function GroupDrawer({ groupId, groupName, onClose, onChanged }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const [members, setMembers] = useState<GroupMemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  function loadMembers() {
    setLoading(true);
    api.groupMembers(groupId).then((res) => {
      if (res.ok) setMembers(res.data.members);
      setLoading(false);
    });
  }

  useEffect(loadMembers, [groupId]);

  async function removeMember(userId: string, email: string | null) {
    if (!await confirm({ title: `Remove ${email ?? userId.slice(0, 8)} from this group?` })) return;
    const res = await api.removeMember(groupId, userId);
    if (!res.ok) { toast({ message: "Failed", kind: "error" }); return; }
    loadMembers();
    onChanged?.();
  }

  async function deleteThisGroup() {
    if (!await confirm({ title: `Permanently delete "${groupName}" and all its messages?`, variant: "destructive", confirmLabel: "Delete group" })) return;
    const res = await api.deleteGroup(groupId);
    if (!res.ok) { toast({ message: "Failed", kind: "error" }); return; }
    onChanged?.();
    onClose();
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" style={{ width: 480 }} role="dialog" aria-modal>
        <header className="drawer-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>{groupName}</h3>
            <div className="subtitle">Group moderation</div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="drawer-body" style={{ paddingTop: 14 }}>
          <div style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--muted-foreground)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 12,
          }}>
            Members ({members.length})
          </div>

          {loading ? (
            <div className="loading">Loading…</div>
          ) : members.length === 0 ? (
            <div className="empty">No members.</div>
          ) : (
            <div>
              {members.map((m) => (
                <div key={m.user_id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", marginBottom: 6, background: "var(--card)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13.5 }}>{m.display_name ?? "—"}</div>
                    <div style={{ color: "var(--muted-foreground)", fontSize: 11.5, fontFamily: "var(--font-mono)" }}>
                      {m.email ?? "—"}
                    </div>
                  </div>
                  <span className={`badge ${m.role === "creator" ? "badge-yellow" : m.role === "admin" ? "badge-blue" : "badge-muted"}`}>{m.role}</span>
                  {m.role !== "creator" && (
                    <button className="btn btn-danger btn-sm" onClick={() => removeMember(m.user_id, m.email)}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px dashed var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Danger zone
            </div>
            <button className="btn btn-danger btn-sm" onClick={deleteThisGroup}>Delete entire group</button>
          </div>
        </div>
      </aside>
    </>
  );
}
