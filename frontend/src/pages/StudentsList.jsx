import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { formatErr } from "@/lib/api";
import { Pill } from "@/components/Pill";
import { Plus, Search, Trash2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

const initialForm = {
  name: "", grade: "10", attendance_pct: 85, study_hours: 2, sleep_hours: 7,
  prev_marks: 70, parental_support: "medium", extracurriculars: 1,
  internet_access: true, tutor: false, notes: "",
};

export default function StudentsList() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [filterBand, setFilterBand] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/students");
      setItems(data);
    } catch (e) {
      toast.error("Failed to load students");
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter((s) => {
    const matchQ = !q || s.name.toLowerCase().includes(q.toLowerCase());
    const matchB = filterBand === "all" || s.last_band === filterBand;
    return matchQ && matchB;
  });

  const upd = (k) => (e) => {
    const v = e.target.type === "number" ? parseFloat(e.target.value) : e.target.value;
    setForm({ ...form, [k]: v });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/students", form);
      toast.success("Student added");
      setOpen(false);
      setForm(initialForm);
      load();
    } catch (e2) {
      toast.error(formatErr(e2.response?.data?.detail));
    } finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this student and all predictions?")) return;
    try {
      await api.delete(`/students/${id}`);
      toast.success("Deleted");
      load();
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="space-y-6 fade-up">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--text-secondary)] mb-2">Roster</div>
          <h1 className="font-display text-4xl md:text-5xl">Students</h1>
          <p className="text-[var(--text-secondary)] mt-2">Manage students and run AI-powered performance predictions.</p>
        </div>
        <button onClick={() => setOpen(true)} data-testid="open-add-student"
          className="btn-primary px-4 py-2.5 rounded-md text-sm flex items-center gap-2 self-start">
          <Plus size={16} /> Add student
        </button>
      </header>

      <div className="surface p-4 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--border-purple)] bg-[#0F0820]">
          <Search size={14} className="text-[var(--text-secondary)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} data-testid="student-search"
            placeholder="Search by name…" className="bg-transparent outline-none w-full text-sm border-0" style={{ background: "transparent" }} />
        </div>
        <div className="flex flex-wrap gap-1">
          {["all", "excellent", "good", "average", "at_risk"].map((b) => (
            <button key={b} onClick={() => setFilterBand(b)}
              data-testid={`filter-${b}`}
              className={`text-xs px-3 py-1.5 rounded-md border ${
                filterBand === b ? "bg-violet-500/15 border-violet-500/40 text-white" : "border-[var(--border-purple)] text-[var(--text-secondary)]"
              }`}>{b === "all" ? "All" : b.replace("_", " ")}</button>
          ))}
        </div>
      </div>

      <div className="surface overflow-hidden">
        <table className="w-full text-sm" data-testid="students-table">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border-purple)]">
              <th className="px-5 py-3">Student</th>
              <th className="px-5 py-3">Grade</th>
              <th className="px-5 py-3">Attendance</th>
              <th className="px-5 py-3">Study</th>
              <th className="px-5 py-3">Last score</th>
              <th className="px-5 py-3">Band</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="7" className="px-5 py-12 text-center text-[var(--text-secondary)]">No students match your filters.</td></tr>
            ) : filtered.map((s) => (
              <tr key={s.id} className="border-b border-[var(--border-purple)] last:border-0 hover:bg-violet-500/5"
                  data-testid={`student-row-${s.id}`}>
                <td className="px-5 py-3">
                  <Link to={`/students/${s.id}`} className="font-medium hover:text-violet-300">{s.name}</Link>
                </td>
                <td className="px-5 py-3 text-[var(--text-secondary)]">{s.grade}</td>
                <td className="px-5 py-3">{s.attendance_pct}%</td>
                <td className="px-5 py-3">{s.study_hours}h</td>
                <td className="px-5 py-3 font-display">{s.last_predicted_score ?? "—"}</td>
                <td className="px-5 py-3"><Pill band={s.last_band} /></td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Link to={`/students/${s.id}`} data-testid={`predict-${s.id}`}
                      className="px-3 py-1.5 text-xs rounded-md border border-violet-500/40 hover:bg-violet-500/10 inline-flex items-center gap-1">
                      <Sparkles size={12} /> Predict
                    </Link>
                    <button onClick={() => del(s.id)} data-testid={`delete-${s.id}`}
                      className="px-2 py-1.5 text-xs rounded-md border border-rose-500/30 text-rose-300 hover:bg-rose-500/10">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="glass max-w-2xl w-full p-6 fade-up" onClick={(e) => e.stopPropagation()} data-testid="add-student-modal">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-2xl">Add student</h2>
              <button onClick={() => setOpen(false)} className="text-[var(--text-secondary)] hover:text-white"><X size={18} /></button>
            </div>
            <StudentForm form={form} upd={upd} />
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm rounded-md border border-[var(--border-purple)]">Cancel</button>
              <button onClick={submit} disabled={saving} data-testid="submit-add-student" className="btn-primary px-4 py-2 text-sm rounded-md">
                {saving ? "Saving…" : "Save student"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function StudentForm({ form, upd }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Name"><input required value={form.name} onChange={upd("name")} data-testid="form-name" className="form-input" /></Field>
      <Field label="Grade"><input value={form.grade} onChange={upd("grade")} data-testid="form-grade" className="form-input" /></Field>
      <Field label={`Attendance ${form.attendance_pct}%`}><input type="range" min="0" max="100" step="1" value={form.attendance_pct} onChange={upd("attendance_pct")} data-testid="form-attendance" /></Field>
      <Field label={`Study hours/day: ${form.study_hours}`}><input type="range" min="0" max="12" step="0.5" value={form.study_hours} onChange={upd("study_hours")} data-testid="form-study" /></Field>
      <Field label={`Sleep hours: ${form.sleep_hours}`}><input type="range" min="0" max="12" step="0.5" value={form.sleep_hours} onChange={upd("sleep_hours")} data-testid="form-sleep" /></Field>
      <Field label={`Previous marks: ${form.prev_marks}`}><input type="range" min="0" max="100" step="1" value={form.prev_marks} onChange={upd("prev_marks")} data-testid="form-prev" /></Field>
      <Field label="Parental support">
        <select value={form.parental_support} onChange={upd("parental_support")} data-testid="form-support" className="form-input">
          <option value="none">None</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </Field>
      <Field label={`Extracurriculars: ${form.extracurriculars}`}><input type="range" min="0" max="10" step="1" value={form.extracurriculars} onChange={upd("extracurriculars")} data-testid="form-extra" /></Field>
      <ToggleField label="Internet access" checked={form.internet_access} onChange={(v) => upd("internet_access")({ target: { value: v } })} testId="form-internet" />
      <ToggleField label="Has tutor" checked={form.tutor} onChange={(v) => upd("tutor")({ target: { value: v } })} testId="form-tutor" />
      <div className="sm:col-span-2">
        <Field label="Notes"><textarea value={form.notes} onChange={upd("notes")} data-testid="form-notes" rows={2} className="form-input" /></Field>
      </div>
      <style>{`
        .form-input { width: 100%; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border-purple); background: #0F0820; color: var(--text-primary); outline: none; }
        .form-input:focus { border-color: #A78BFA; }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">{label}</label>
      {children}
    </div>
  );
}
function ToggleField({ label, checked, onChange, testId }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)] mb-2 block">{label}</label>
      <button type="button" onClick={() => onChange(!checked)} data-testid={testId}
        className={`px-3 py-2.5 rounded-md text-sm border w-full text-left ${
          checked ? "bg-violet-500/15 border-violet-500/40" : "border-[var(--border-purple)] text-[var(--text-secondary)]"
        }`}>{checked ? "Yes" : "No"}</button>
    </div>
  );
}
