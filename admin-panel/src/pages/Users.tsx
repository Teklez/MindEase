import { useEffect, useState } from "react";
import { api, formatDate, type AdminUser } from "../lib/api";
import UserDrawer from "../components/UserDrawer";

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [res, meRes] = await Promise.all([
      api.users({ page, q: q || undefined, status: statusFilter || undefined, role: roleFilter || undefined }),
      api.me(),
    ]);
    if (res.ok) {
      setUsers(res.data.users);
      setTotal(res.data.total);
    }
    if (meRes.ok) setMe(meRes.data.user_id);
    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q, statusFilter, roleFilter]);

  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="page" style={{ maxWidth: "100%" }}>
      <div className="page-header">
        <h2>Users</h2>
        <p>{total.toLocaleString()} registered users</p>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="left">
            <input
              className="search-input"
              placeholder="Search email or name…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
            />
            <select className="filter-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <select className="filter-select" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
              <option value="">All roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>
          <span className="count">{total.toLocaleString()} total</span>
        </div>
        {loading ? (
          <div className="loading">Loading…</div>
        ) : users.length === 0 ? (
          <div className="empty">No users match.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Role</th>
                  <th>Provider</th>
                  <th>Joined</th>
                  <th>Last login</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id} className="clickable" onClick={() => setSelected(u.user_id)}>
                    <td>{u.email}</td>
                    <td>{u.display_name}</td>
                    <td>
                      <span className={`badge ${u.account_status === "active" ? "badge-green" : "badge-red"}`}>
                        {u.account_status}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.is_admin ? "badge-yellow" : "badge-muted"}`}>
                        {u.is_admin ? "admin" : "user"}
                      </span>
                    </td>
                    <td style={{ color: "var(--muted-foreground)", fontSize: 12.5 }}>{u.oauth_provider || "password"}</td>
                    <td style={{ color: "var(--muted-foreground)" }}>{formatDate(u.created_at)}</td>
                    <td style={{ color: "var(--muted-foreground)" }}>{formatDate(u.last_login)}</td>
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
        <UserDrawer
          userId={selected}
          onClose={() => setSelected(null)}
          onUpdated={load}
          selfUserId={me}
        />
      )}
    </div>
  );
}
