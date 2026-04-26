import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Pill, BAND_COLOR, BAND_LABEL } from "@/components/Pill";
import { Users, TrendingUp, AlertTriangle, Crown, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

const tipStyle = { background: "rgba(27,16,44,0.9)", border: "1px solid rgba(139,92,246,0.4)",
                   borderRadius: 8, padding: "8px 12px", fontFamily: "Manrope" };

function Kpi({ icon: Icon, label, value, accent = "#A78BFA", testId }) {
  return (
    <div className="surface p-6 card-hover" data-testid={testId}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">{label}</span>
        <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: `${accent}22`, color: accent }}>
          <Icon size={16} />
        </div>
      </div>
      <div className="font-display text-4xl tracking-tight">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data)).catch(() => setData({ total_students: 0, avg_score: 0, at_risk_count: 0, top_performer: null, band_counts: {}, recent_predictions: [] }));
  }, []);

  if (!data) return <div className="text-[var(--text-secondary)]">Loading…</div>;

  const bandData = Object.entries(data.band_counts || {}).map(([k, v]) => ({
    name: BAND_LABEL[k] || k, key: k, value: v,
  }));
  const hasBands = bandData.some((b) => b.value > 0);

  return (
    <div className="space-y-8 fade-up">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--text-secondary)] mb-2">Overview</div>
          <h1 className="font-display text-4xl md:text-5xl">Performance dashboard</h1>
          <p className="text-[var(--text-secondary)] mt-2 max-w-xl">A live snapshot of your students' predicted outcomes, factor breakdowns and recent insights.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/predict" data-testid="cta-quick-predict" className="px-4 py-2.5 rounded-md border border-violet-500/40 text-sm hover:bg-violet-500/10 flex items-center gap-2">
            <Sparkles size={14} /> Quick predict
          </Link>
          <Link to="/students" data-testid="cta-add-student" className="btn-primary px-4 py-2.5 rounded-md text-sm flex items-center gap-2">
            <Users size={14} /> Manage students
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Kpi testId="kpi-total" icon={Users} label="Total students" value={data.total_students} accent="#A78BFA" />
        <Kpi testId="kpi-avg" icon={TrendingUp} label="Avg predicted" value={data.avg_score} accent="#60A5FA" />
        <Kpi testId="kpi-risk" icon={AlertTriangle} label="At risk" value={data.at_risk_count} accent="#FB7185" />
        <Kpi testId="kpi-top" icon={Crown} label="Top performer"
          value={data.top_performer ? `${data.top_performer.score}` : "—"} accent="#34D399" />
        {data.top_performer && (
          <div className="sm:col-span-2 lg:col-span-4 -mt-3 text-xs text-[var(--text-secondary)] pl-1" data-testid="top-performer-name">
            Top: <span className="text-white">{data.top_performer.name}</span>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="surface p-6 lg:col-span-2" data-testid="chart-band-breakdown">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg">Performance bands</h3>
            <span className="text-xs text-[var(--text-secondary)]">Across {data.total_students} students</span>
          </div>
          {hasBands ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bandData}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#A79FC4" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#A79FC4" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tipStyle} cursor={{ fill: "rgba(139,92,246,0.08)" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {bandData.map((d) => <Cell key={d.key} fill={BAND_COLOR[d.key] || "#8B5CF6"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-[var(--text-secondary)] text-sm">
              No predictions yet. Add students and run a prediction to see breakdowns.
            </div>
          )}
        </div>

        <div className="surface p-6" data-testid="chart-band-pie">
          <h3 className="font-display text-lg mb-4">Distribution</h3>
          {hasBands ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={bandData} dataKey="value" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {bandData.map((d) => <Cell key={d.key} fill={BAND_COLOR[d.key] || "#8B5CF6"} />)}
                </Pie>
                <Tooltip contentStyle={tipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#A79FC4" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-[var(--text-secondary)] text-sm text-center px-4">
              Run predictions to populate the distribution chart.
            </div>
          )}
        </div>
      </section>

      <section className="surface p-6" data-testid="recent-predictions">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg">Recent predictions</h3>
          <Link to="/students" className="text-xs text-violet-300 hover:text-violet-200">View all students →</Link>
        </div>
        {data.recent_predictions.length === 0 ? (
          <div className="text-sm text-[var(--text-secondary)] py-6 text-center">No recent predictions yet.</div>
        ) : (
          <ul className="divide-y divide-[var(--border-purple)]">
            {data.recent_predictions.map((p) => (
              <li key={p.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{p.insight}</div>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-1">{new Date(p.created_at).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-2xl">{p.score}</div>
                  <Pill band={p.band} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
