import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, formatErr } from "@/context/AuthContext";
import { Sparkles, GraduationCap } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "teacher" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await register(form);
      toast.success("Account created");
      navigate("/");
    } catch (e2) {
      const msg = formatErr(e2.response?.data?.detail) || e2.message;
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-bg grain min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md fade-up relative z-10">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-12 h-12 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-700 flex items-center justify-center">
            <GraduationCap size={22} className="text-white" />
          </div>
          <div className="font-display text-2xl">Scholar<span className="text-violet-400">.</span>ai</div>
        </div>

        <div className="glass p-8" data-testid="register-card">
          <h1 className="font-display text-3xl mb-1">Create your account</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6">Start predicting student performance in seconds.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2 block">Full name</label>
              <input required value={form.name} onChange={upd("name")} data-testid="register-name"
                className="w-full px-4 py-3 rounded-md border outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2 block">Email</label>
              <input type="email" required value={form.email} onChange={upd("email")} data-testid="register-email"
                className="w-full px-4 py-3 rounded-md border outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2 block">Password</label>
              <input type="password" required minLength={6} value={form.password} onChange={upd("password")} data-testid="register-password"
                className="w-full px-4 py-3 rounded-md border outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2 block">I am a</label>
              <div className="grid grid-cols-2 gap-2">
                {["teacher", "student"].map((r) => (
                  <button type="button" key={r} onClick={() => setForm({ ...form, role: r })}
                    data-testid={`register-role-${r}`}
                    className={`py-2.5 rounded-md text-sm border ${
                      form.role === r ? "bg-violet-500/15 border-violet-500/40 text-white" : "border-[var(--border-purple)] text-[var(--text-secondary)]"
                    }`}>{r === "teacher" ? "Teacher" : "Student"}</button>
                ))}
              </div>
            </div>
            {err && <div className="text-sm text-rose-300" data-testid="register-error">{err}</div>}
            <button disabled={loading} type="submit" data-testid="register-submit"
              className="btn-primary w-full py-3 rounded-md font-medium flex items-center justify-center gap-2">
              <Sparkles size={16} />
              {loading ? "Creating…" : "Create account"}
            </button>
          </form>

          <div className="text-sm text-[var(--text-secondary)] mt-6 text-center">
            Already have one?{" "}
            <Link to="/login" className="text-violet-300 hover:text-violet-200" data-testid="link-login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
