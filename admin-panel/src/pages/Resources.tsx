import { useEffect, useState } from "react";
import { api, type ResourceRow } from "../lib/api";
import CreateResourceDrawer from "../components/CreateResourceDrawer";
import { useConfirm, useToast } from "../components/UI";

export default function Resources() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.resources();
    if (res.ok) setRows(res.data.resources);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(r: ResourceRow) {
    if (!await confirm({ title: `${r.is_active ? "Hide" : "Activate"} resource "${r.title}"?` })) return;
    const res = await api.updateResource(r.resource_id, { is_active: !r.is_active });
    if (!res.ok) { toast({ message: "Update failed", kind: "error" }); return; }
    load();
  }

  return (
    <div className="page" style={{ maxWidth: "100%" }}>
      <div className="page-header">
        <h2>Resources</h2>
        <p>Wellness content library</p>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <span className="count">{rows.length.toLocaleString()} resources</span>
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ New resource</button>
        </div>
        {loading ? (
          <div className="loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty">No resources.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.resource_id}>
                    <td style={{ fontWeight: 500 }}>
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noreferrer" style={{ color: "var(--primary-deep)" }}>
                          {r.title}
                        </a>
                      ) : r.title}
                    </td>
                    <td style={{ color: "var(--muted-foreground)" }}>{r.category ?? "—"}</td>
                    <td><span className="badge badge-muted">{r.resource_type}</span></td>
                    <td style={{ color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{r.duration ?? "—"}</td>
                    <td>
                      <span className={`badge ${r.is_active ? "badge-green" : "badge-red"}`}>
                        {r.is_active ? "active" : "hidden"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className={`btn btn-sm ${r.is_active ? "btn-danger" : "btn-primary"}`}
                        onClick={() => toggleActive(r)}
                      >
                        {r.is_active ? "Hide" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {creating && <CreateResourceDrawer onClose={() => setCreating(false)} onCreated={load} />}
    </div>
  );
}
