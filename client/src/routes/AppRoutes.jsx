import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import ProtectedRoute from "../components/ProtectedRoute";
import RoleRoute from "../components/RoleRoute";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import NotFoundPage from "../pages/NotFoundPage";
import Loader from "../components/Loader";

const DashboardPage = lazy(() => import("../pages/DashboardPage"));
const InvestigationsPage = lazy(() => import("../pages/InvestigationsPage"));
const ModelsPage = lazy(() => import("../pages/ModelsPage"));
const TransactionDetailsPage = lazy(() => import("../pages/TransactionDetailsPage"));
const TransactionsPage = lazy(() => import("../pages/TransactionsPage"));
const UsersPage = lazy(() => import("../pages/UsersPage"));

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route element={<Suspense fallback={<Loader label="Loading page…" />}><Outlet /></Suspense>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/transactions/:id" element={<TransactionDetailsPage />} />
            <Route path="/models" element={<ModelsPage />} />
            <Route path="/investigations" element={<InvestigationsPage />} />
            <Route element={<RoleRoute allowedRoles={["admin"]} />}>
              <Route path="/users" element={<UsersPage />} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
