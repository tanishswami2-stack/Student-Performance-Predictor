import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "sonner";

import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import StudentsList from "@/pages/StudentsList";
import StudentDetail from "@/pages/StudentDetail";
import QuickPredict from "@/pages/QuickPredict";
import ImportExport from "@/pages/ImportExport";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-bg min-h-screen flex items-center justify-center">
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-violet-400 dot-pulse" style={{ animationDelay: "0s" }} />
          <span className="w-2 h-2 rounded-full bg-violet-400 dot-pulse" style={{ animationDelay: "0.2s" }} />
          <span className="w-2 h-2 rounded-full bg-violet-400 dot-pulse" style={{ animationDelay: "0.4s" }} />
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/students" element={<Protected><StudentsList /></Protected>} />
            <Route path="/students/:id" element={<Protected><StudentDetail /></Protected>} />
            <Route path="/predict" element={<Protected><QuickPredict /></Protected>} />
            <Route path="/import-export" element={<Protected><ImportExport /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster theme="dark" position="top-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
