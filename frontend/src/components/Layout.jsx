import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Users, Sparkles, FileSpreadsheet, LogOut, GraduationCap } from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/students", label: "Students", icon: Users },
  { to: "/predict", label: "Quick Predict", icon: Sparkles },
  { to: "/import-export", label: "Import / Export", icon: FileSpreadsheet },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="app-bg grain min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-[var(--border-purple)] hidden md:flex flex-col" data-testid="sidebar">
        <div className="px-6 py-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-700 flex items-center justify-center">
            <GraduationCap size={20} className="text-white" />
          </div>
          <div>
            <div className="font-display text-lg leading-none">Scholar<span className="text-violet-400">.</span>ai</div>
            <div className="text-[11px] text-[var(--text-secondary)] tracking-widest uppercase mt-1">Predictor</div>
          </div>
        </div>

        <nav className="px-3 mt-2 flex-1 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-md text-sm transition-all ${
                  isActive
                    ? "bg-violet-500/15 text-white border border-violet-500/30"
                    : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5 border border-transparent"
                }`
              }
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[var(--border-purple)]">
          <div className="px-2 mb-2">
            <div className="text-sm font-medium truncate" data-testid="sidebar-user-name">{user?.name}</div>
            <div className="text-xs text-[var(--text-secondary)] truncate" data-testid="sidebar-user-email">{user?.email}</div>
          </div>
          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            className="w-full flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-white px-3 py-2 rounded-md hover:bg-white/5"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 glass m-3 px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-display text-lg flex items-center gap-2">
          <GraduationCap size={18} /> Scholar.ai
        </Link>
        <button onClick={handleLogout} className="text-xs text-[var(--text-secondary)]" data-testid="mobile-logout">
          <LogOut size={16} />
        </button>
      </div>

      {/* Main */}
      <main className="flex-1 min-w-0 relative z-10 pt-20 md:pt-0">
        <div className="md:hidden flex overflow-x-auto px-3 gap-2 mb-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"}
              className={({ isActive }) =>
                `whitespace-nowrap text-xs px-3 py-2 rounded-md border ${
                  isActive ? "bg-violet-500/15 border-violet-500/30 text-white" : "border-[var(--border-purple)] text-[var(--text-secondary)]"
                }`
              }>
              <Icon size={12} className="inline mr-1" />{label}
            </NavLink>
          ))}
        </div>
        <div className="px-6 lg:px-10 py-6 lg:py-10 max-w-[1500px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
