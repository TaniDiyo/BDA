import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotAuthorizedPage from "../pages/NotAuthorizedPage";

export default function RoleRoute({ allowedRoles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) return <NotAuthorizedPage />;
  return <Outlet />;
}
