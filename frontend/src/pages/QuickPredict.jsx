import { useState } from "react";
import api, { formatErr } from "@/lib/api";
import { Pill, BAND_COLOR } from "@/components/Pill";
import { Sparkles } from "lucide-react";
import { StudentForm } from "@/pages/StudentsList";
import { toast } from "sonner";

const initial = {
  name: "Me", grade: "10", attendance_pct: 85, study_hours: 2, sleep_hours: 7,
  prev_marks: 70, parental_support: "medium", extracurriculars: 1,
  internet_access: true, tutor: false, notes: "",
};

export default function QuickPredict() {
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const upd = (k) => (e) => {
    const t = e.target;
    const v = t.type === "number" || t.type === "range" ? parseFloat(t.value) : t.value;
    setForm({ ...form, [k]: v });
  };

  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/predict-quick", form);
      setResult(data);
    } catch (e) {
      toast.error(formatErr(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 fade-up">
      <header>
        <div className="text-xs uppercase tracking-widest text-[var(--text-secondary)] mb-2">Self-prediction</div>
        <h1 className="font-display text-4xl md:text-5xl">Quick predict</h1>
        <p className="text-[var(--text-secondary)] mt-2 max-w-2xl">Tweak the sliders and instantly see a predicted academic score, AI insight, and recommendations — no record saved.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <section className="surface p-6 lg:col-span-3">
          <h3 className="font-display text-lg mb-4">Your factors</h3>
          <StudentForm form={form} upd={upd} />
          <button onClick={run} disabled={loading} data-testid="quick-predict-run"
            className="btn-primary mt-6 px-5 py-3 rounded-md text-sm flex items-center gap-2">
            <Sparkles size={14} /> {loading ? "Analyzing with AI…" : "Predict my score"}
          </button>
        </section>

        <aside className="lg:col-span-2 space-y-5" data-testid="quick-predict-result">
          {result ? (
            <>
              <div className="surface p-6">
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">Predicted score</div>
                <div className="flex items-end gap-3 mt-2">
                  <div className="font-display text-7xl tracking-tighter" style={{ color: BAND_COLOR[result.band] }}>
                    {result.score}
                  </div>
                  <div className="mb-3"><Pill band={result.band} /></div>
                </div>
                <p className="text-sm mt-4 italic border-l-2 border-violet-500/40 pl-4">"{result.insight}"</p>
              </div>
              <div className="surface p-6">
                <h4 className="font-display text-base mb-3">Recommendations</h4>
                <ul className="space-y-2">
                  {result.recommendations.map((r, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-violet-400 mt-1">▸</span><span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="surface p-8 text-center">
              <Sparkles size={28} className="text-violet-400 mx-auto mb-3" />
              <h3 className="font-display text-xl mb-1">Ready when you are</h3>
              <p className="text-sm text-[var(--text-secondary)]">Adjust your inputs, then hit "Predict my score".</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
