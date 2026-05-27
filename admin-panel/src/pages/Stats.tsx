import { useEffect, useState } from "react";
import { api, type AdminStats, type ChartPoint, type ActivityItem, relativeTime } from "../lib/api";
import { IconUserPlus, IconAlert, IconClipboard } from "../components/Icons";

function Card({ label, value, tone, delta }: { label: string; value: number | string; tone?: "primary" | "danger" | "warning"; delta?: string }) {
  return (
    <div className={`stat-card ${tone ?? ""}`}>
      <div className="label">{label}</div>
      <div className="value">{typeof value === "number" ? value.toLocaleString() : value}</div>
      {delta && <div className="delta">{delta}</div>}
    </div>
  );
}

function SignupsChart({ data }: { data: ChartPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="chart-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "16px", fontWeight: 500 }}>Daily signups</h3>
        <span style={{ fontSize: "11.5px", fontFamily: "var(--font-mono)", color: "var(--muted-foreground)" }}>last {data.length} days</span>
      </div>
      <div className="chart-bars">
        {data.map((d) => {
          const h = Math.max(2, (d.count / max) * 100);
          return (
            <div key={d.date} className="chart-bar" style={{ height: `${h}%` }}>
              <div className="tip">{d.count} on {d.date.slice(5)}</div>
            </div>
          );
        })}
      </div>
      <div className="chart-labels">
        <span>{data[0]?.date.slice(5) ?? ""}</span>
        <span style={{ flex: 6 }} />
        <span style={{ textAlign: "right" }}>{data[data.length - 1]?.date.slice(5) ?? ""}</span>
      </div>
    </div>
  );
}

function ActivityIcon({ type }: { type: ActivityItem["type"] }) {
  if (type === "signup") return <div className="activity-icon"><IconUserPlus /></div>;
  if (type === "crisis") return <div className="activity-icon danger"><IconAlert /></div>;
  return <div className="activity-icon info"><IconClipboard /></div>;
}

function describe(item: ActivityItem): string {
  if (item.type === "signup") return `${item.user_name ?? item.user_email ?? "User"} joined`;
  if (item.type === "crisis") return `Crisis flagged · review in Crisis Flags`;
  return `Assessment completed · score ${item.score} (${item.level})`;
}

export default function Stats() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.stats(), api.signupsChart(14), api.activity()]).then(([s, c, a]) => {
      if (s.ok) setStats(s.data);
      if (c.ok) setChart(c.data.series);
      if (a.ok) setActivity(a.data.items);
      setLoading(false);
    });
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h2>Overview</h2>
        <p>Real-time platform analytics</p>
      </div>

      {loading ? (
        <div className="loading">Loading…</div>
      ) : stats ? (
        <>
          <div className="stats-grid">
            <Card label="Total Users" value={stats.total_users} tone="primary" delta={`+${stats.new_users_7d} this week`} />
            <Card label="Active (30d)" value={stats.active_users_30d} tone="primary" />
            <Card label="Conversations" value={stats.total_conversations} />
            <Card label="Messages" value={stats.total_messages} />
            <Card label="Mood Entries" value={stats.total_mood_entries} />
            <Card label="Assessments" value={stats.total_assessments_taken} />
            <Card label="Groups" value={stats.total_groups} />
            <Card label="Crisis Flags" value={stats.crisis_messages} tone="danger" />
          </div>

          <div className="two-col">
            <SignupsChart data={chart} />
            <div>
              <div className="section-header">
                <h3>Recent activity</h3>
              </div>
              <div className="activity-feed">
                {activity.length === 0 ? (
                  <div className="empty">No recent activity.</div>
                ) : (
                  activity.map((item, i) => (
                    <div key={i} className="activity-item">
                      <ActivityIcon type={item.type} />
                      <div className="activity-body">
                        <div className="desc">{describe(item)}</div>
                        <div className="time">{relativeTime(item.timestamp)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="empty">Failed to load stats.</div>
      )}
    </div>
  );
}
