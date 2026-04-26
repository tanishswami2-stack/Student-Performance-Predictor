import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api, { formatErr } from "@/lib/api";
import { Pill, BAND_COLOR } from "@/components/Pill";
import { StudentForm } from "@/pages/StudentsList";
import { Sparkles, ArrowLeft, Save, ChevronRight } from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from "recharts";
import { toast } from "sonner";

const tipStyle = { background: "rgba(27,16,44,0.9)", border: "1px solid rgba(139,92,246,0.4)", borderRadius: 8, padding: "8px 12px", fontFamily: "Manrope" };

const FACTOR_LABEL = {
  prev_marks: "Prev Marks", attendance: "Attendance", study: "Study",
  sleep: "Sleep", support: "Support", tutor: "Tutor", internet: "Internet", extra: "Extracurr.",
};

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [history, setHistory] = useState([]);
  const [predicting, setPredicting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [latest, setLatest] = useState(null);

  const load = async () => {
    try {
      const [s, h] = await Promise.all([
        api.get(`/students/${id}`),
        api.get(`/students/${id}/predictions`),
      ]);
      setStudent(s.data);
      setHistory(h.data);
      setLatest(h.data[0] || null);
    } catch {
      toast.error("Could not load student");
      navigate("/students");
    }
  };
  useEffect(() => { load(); /* eslint-disable-line */ }, [id]);

  const upd = (k) => (e) => {
    const t = e.target;
    const v = t.type === "number" || t.type === "range" ? parseFloat(t.value) : t.value;
    setStudent({ ...student, [k]: v });
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = (({ name, grade, attendance_pct, study_hours, sleep_hours, prev_marks,
        parental_support, extracurriculars, internet_access, tutor, notes }) =>
        ({ name, grade, attendance_pct, study_hours, sleep_hours, prev_marks,
           parental_support, extracurriculars, internet_access, tutor, notes }))(student);
      await api.put(`/students/${id}`, payload);
      toast.success("Saved");
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const predict = async () => {
    setPredicting(true);
    try {
      const { data } = await api.post(`/students/${id}/predict`);
      setLatest(data);
      setHistory((h) => [data, ...h]);
      setStudent((s) => ({ ...s, last_predicted_score: data.score, last_band: data.band }));
      toast.success("Prediction generated");
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
    finally { setPredicting(false); }
  };

  const radarData = useMemo(() => {
    if (!latest) return [];
    return Object.entries(latest.factors).map(([k, v]) => ({
      factor: FACTOR_LABEL[k] || k,
      value: Math.round(v * 100),
    }));
  }, [latest]);

  const barData = useMemo(() => {
    if (!latest) return [];
    return Object.entries(latest.contributions).map(([k, v]) => ({
      factor: FACTOR_LABEL[k] || k,
      value: v,
    })).sort((a, b) => b.value - a.value);
  }, [latest]);

  const trendData = useMemo(() => {
    return [...history].reverse().map((h, i) => ({
      idx: i + 1,
      score: h.score,
      date: new Date(h.created_at).toLocaleDateString(),
    }));
  }, [history]);

  if (!student) return <div className="text-[var(--text-secondary)]">Loading…</div>;

  return (
    <div className="space-y-6 fade-up">
      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <Link to="/students" className="flex items-center gap-1 hover:text-white"><ArrowLeft size={12} /> Students</Link>
        <ChevronRight size={12} />
        <span className="text-white">{student.name}</span>
      </div>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl md:text-5xl">{student.name}</h1>
          <div className="text-[var(--text-secondary)] mt-2 flex gap-3 items-center">
            <span>Grade {student.grade}</span>
            <span>•</span>
            <span>{history.length} predictions</span>
            {student.last_band && <Pill band={student.last_band} />}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} data-testid="save-student"
            className="px-4 py-2.5 rounded-md text-sm border border-[var(--border-purple)] hover:bg-white/5 flex items-center gap-2">
            <Save size={14} /> {saving ? "Saving…" : "Save changes"}
          </button>
          <button onClick={predict} disabled={predicting} data-testid="run-predict"
            className="btn-primary px-4 py-2.5 rounded-md text-sm flex items-center gap-2">
            <Sparkles size={14} /> {predicting ? "Analyzing…" : "Run prediction"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="surface p-6">
          <h3 className="font-display text-lg mb-4">Profile factors</h3>
          <StudentForm form={student} upd={upd} />
        </section>

        <section className="space-y-5">
          {latest ? (
            <>
              <div className="surface p-6" data-testid="latest-prediction">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">Latest prediction</div>
                    <div className="flex items-end gap-3 mt-2">
                      <div className="font-display text-6xl tracking-tighter" style={{ color: BAND_COLOR[latest.band] }}>{latest.score}</div>
                      <div className="mb-2"><Pill band={latest.band} /></div>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-1">{new Date(latest.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <div className="text-sm leading-relaxed text-[var(--text-primary)]/90 italic border-l-2 border-violet-500/40 pl-4">
                  "{latest.insight}"
                </div>
              </div>

              <div className="surface p-6">
                <h4 className="font-display text-base mb-3">Recommendations</h4>
                <ul className="space-y-2">
                  {latest.recommendations.map((r, i) => (
                    <li key={i} className="text-sm flex gap-2" data-testid={`recommendation-${i}`}>
                      <span className="text-violet-400 mt-1">▸</span>
                      <span className="text-[var(--text-primary)]/90">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="surface p-8 text-center">
              <Sparkles size={28} className="text-violet-400 mx-auto mb-3" />
              <h3 className="font-display text-xl mb-2">No predictions yet</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">Click "Run prediction" to analyze {student.name}'s performance with AI.</p>
              <button onClick={predict} disabled={predicting} className="btn-primary px-4 py-2.5 rounded-md text-sm">
                {predicting ? "Analyzing…" : "Run first prediction"}
              </button>
            </div>
          )}
        </section>
      </div>

      {latest && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="surface p-6" data-testid="chart-radar">
            <h3 className="font-display text-lg mb-4">Factor strength</h3>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="factor" stroke="#A79FC4" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="rgba(255,255,255,0.1)" tick={{ fontSize: 10 }} />
                <Radar name="Strength" dataKey="value" stroke="#A78BFA" fill="#8B5CF6" fillOpacity={0.35} />
                <Tooltip contentStyle={tipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="surface p-6" data-testid="chart-contributions">
            <h3 className="font-display text-lg mb-4">Score contribution by factor</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" stroke="#A79FC4" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="factor" type="category" stroke="#A79FC4" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip contentStyle={tipStyle} cursor={{ fill: "rgba(139,92,246,0.08)" }} formatter={(v) => `${v} pts`} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {barData.map((d, i) => <Cell key={i} fill={`hsl(${268 + i * 3}, 70%, ${55 + i * 2}%)`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {history.length > 1 && (
        <section className="surface p-6" data-testid="chart-trend">
          <h3 className="font-display text-lg mb-4">Score trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" stroke="#A79FC4" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} stroke="#A79FC4" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tipStyle} />
              <Line type="monotone" dataKey="score" stroke="#A78BFA" strokeWidth={2.5} dot={{ r: 4, fill: "#8B5CF6" }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {history.length > 0 && (
        <section className="surface p-6" data-testid="prediction-history">
          <h3 className="font-display text-lg mb-4">Prediction history</h3>
          <ul className="divide-y divide-[var(--border-purple)]">
            {history.map((p) => (
              <li key={p.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm truncate">{p.insight}</div>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-1">{new Date(p.created_at).toLocaleString()}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-xl">{p.score}</div>
                  <Pill band={p.band} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
