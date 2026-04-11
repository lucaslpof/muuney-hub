import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const Loading = () => (
  <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
    <div className="w-8 h-8 rounded-full border-2 border-[#0B6C3E] border-t-transparent animate-spin" />
  </div>
);

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
