import { useEffect, useState } from "react";
import { api, formatDate, type GroupRow } from "../lib/api";
import GroupDrawer from "../components/GroupDrawer";

export default function Groups() {
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  async function load() {
    setLoading(true);
    const res = await api.groups(page);
    if (res.ok) {
      setRows(res.data.groups);
      setTotal(res.data.total);
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page]);

  async function toggleActive(g: GroupRow) {
    if (!confirm(`${g.is_active ? "Hide" : "Activate"} group "${g.name}"?`)) return;
    const res = await api.updateGroup(g.group_id, { is_active: !g.is_active });
    if (!res.ok) { alert("Update failed"); return; }
    load();
  }

  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="page" style={{ maxWidth: "100%" }}>
      <div className="page-header">
        <h2>Groups</h2>
        <p>Community support groups</p>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <span className="count">{total.toLocaleString()} groups</span>
        </div>
        {loading ? (
          <div className="loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty">No groups yet.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Members</th>
                  <th>Visibility</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.group_id} className="clickable" onClick={() => setSelected({ id: g.group_id, name: g.name })}>
                    <td style={{ fontWeight: 500 }}>{g.name}</td>
                    <td style={{ color: "var(--muted-foreground)" }}>{g.category ?? "—"}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{g.member_count} / {g.max_members}</td>
                    <td>
                      <span className={`badge ${g.is_public ? "badge-blue" : "badge-muted"}`}>
                        {g.is_public ? "public" : "private"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${g.is_active ? "badge-green" : "badge-red"}`}>
                        {g.is_active ? "active" : "hidden"}
                      </span>
                    </td>
                    <td style={{ color: "var(--muted-foreground)" }}>{formatDate(g.created_at)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className={`btn btn-sm ${g.is_active ? "btn-danger" : "btn-primary"}`}
                        onClick={(e) => { e.stopPropagation(); toggleActive(g); }}
                      >
                        {g.is_active ? "Hide" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="pagination">
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
            <span>Page {page} / {pages}</span>
            <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </div>
      {selected && (
        <GroupDrawer
          groupId={selected.id}
          groupName={selected.name}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
