import { useState, useRef } from "react";
import api, { API } from "@/lib/api";
import { Download, Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function ImportExport() {
  const fileRef = useRef(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const exportCsv = async () => {
    setBusy(true);
    try {
      const token = localStorage.getItem("spp_token");
      const res = await fetch(`${API}/students/export/csv`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "students.csv"; a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch { toast.error("Failed to export"); }
    finally { setBusy(false); }
  };

  const importCsv = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/students/import/csv", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      toast.success(`Imported ${data.inserted} students`);
    } catch { toast.error("Import failed"); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <div className="space-y-6 fade-up">
      <header>
        <div className="text-xs uppercase tracking-widest text-[var(--text-secondary)] mb-2">Bulk operations</div>
        <h1 className="font-display text-4xl md:text-5xl">Import &amp; Export</h1>
        <p className="text-[var(--text-secondary)] mt-2 max-w-2xl">Move student rosters in or out of Scholar.ai with a CSV file.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="surface p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-md bg-violet-500/15 flex items-center justify-center"><Download size={18} className="text-violet-300" /></div>
            <h3 className="font-display text-xl">Export to CSV</h3>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mb-4">Download all your students with their latest predicted scores and bands.</p>
          <button onClick={exportCsv} disabled={busy} data-testid="export-btn"
            className="btn-primary px-4 py-2.5 rounded-md text-sm flex items-center gap-2">
            <Download size={14} /> Download students.csv
          </button>
        </div>

        <div className="surface p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-md bg-violet-500/15 flex items-center justify-center"><Upload size={18} className="text-violet-300" /></div>
            <h3 className="font-display text-xl">Import from CSV</h3>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mb-4">Columns: name, grade, attendance_pct, study_hours, sleep_hours, prev_marks, parental_support, extracurriculars, internet_access, tutor, notes.</p>
          <input ref={fileRef} type="file" accept=".csv" onChange={importCsv} className="hidden" data-testid="import-file" />
          <button onClick={() => fileRef.current?.click()} disabled={busy} data-testid="import-btn"
            className="px-4 py-2.5 rounded-md text-sm border border-violet-500/40 hover:bg-violet-500/10 flex items-center gap-2">
            <FileSpreadsheet size={14} /> Choose CSV file
          </button>
          {result && (
            <div className="mt-4 surface-2 p-4" data-testid="import-result">
              <div className="flex items-center gap-2 text-sm text-emerald-300">
                <CheckCircle2 size={14} /> Imported {result.inserted} students
              </div>
              {result.errors?.length > 0 && (
                <details className="mt-2 text-xs text-rose-300">
                  <summary className="cursor-pointer">{result.errors.length} errors</summary>
                  <ul className="mt-2 space-y-1">{result.errors.map((e, i) => <li key={i}>• {e}</li>)}</ul>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
