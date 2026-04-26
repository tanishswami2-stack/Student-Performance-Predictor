import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, formatErr } from "@/context/AuthContext";
import { Sparkles, GraduationCap } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
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
    <div className="app-bg grain min-h-screen flex items-center justify-center px-4 relative">
      <div className="w-full max-w-md fade-up relative z-10">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-12 h-12 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-700 flex items-center justify-center">
            <GraduationCap size={22} className="text-white" />
          </div>
          <div>
            <div className="font-display text-2xl">Scholar<span className="text-violet-400">.</span>ai</div>
            <div className="text-xs tracking-widest uppercase text-[var(--text-secondary)]">Performance Predictor</div>
          </div>
        </div>

        <div className="glass p-8" data-testid="login-card">
          <h1 className="font-display text-3xl mb-1">Welcome back</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6">Sign in to predict student outcomes with AI.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2 block">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email"
                className="w-full px-4 py-3 rounded-md border outline-none focus:border-violet-400"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2 block">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password"
                className="w-full px-4 py-3 rounded-md border outline-none focus:border-violet-400"
              />
            </div>
            {err && <div className="text-sm text-rose-300" data-testid="login-error">{err}</div>}
            <button
              disabled={loading}
              type="submit"
              data-testid="login-submit"
              className="btn-primary w-full py-3 rounded-md font-medium flex items-center justify-center gap-2"
            >
              <Sparkles size={16} />
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="text-sm text-[var(--text-secondary)] mt-6 text-center">
            New here?{" "}
            <Link to="/register" className="text-violet-300 hover:text-violet-200" data-testid="link-register">
              Create an account
            </Link>
          </div>
        </div>

        <div className="text-xs text-[var(--text-muted)] text-center mt-6">
          Demo credentials are pre-filled for quick exploration.
        </div>
      </div>
    </div>
  );
}
