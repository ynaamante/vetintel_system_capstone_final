import { createBrowserRouter, Navigate } from "react-router-dom";
import { DashboardLayout } from "./components/DashboardLayout";
import { Dashboard } from "./components/pages/Dashboard";
import { ClinicManagement } from "./components/pages/ClinicManagement";
import { UserManagement } from "./components/pages/UserManagement";
import { RolesPermissions } from "./components/pages/RolesPermissions";
import { AuditTrail } from "./components/pages/AuditTrail";
import { Settings } from "./components/pages/Settings";
import { ClinicDetails } from "./components/pages/ClinicDetails";
import { Login } from "./components/pages/Login";
import { SystemAnnouncements } from "./components/pages/SystemAnnouncements";
import { ActiveClinics, DemoRequests, Inbox, PlanSubscribers, RoleRequests, SubscriptionPlans } from "./components/pages/ReferenceScreens";
import { isSystemAdmin } from "../utils/permissionUtils";

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const userData = localStorage.getItem('vetintel_user');
  const token = localStorage.getItem('vetintel_token');

  if (!userData || !token) {
    localStorage.removeItem('vetintel_user');
    localStorage.removeItem('vetintel_token');
    return <Navigate to="/login" replace />;
  }

  let user;
  try {
    user = JSON.parse(userData);
  } catch (error) {
    localStorage.removeItem('vetintel_user');
    localStorage.removeItem('vetintel_token');
    return <Navigate to="/login" replace />;
  }

  if (!isSystemAdmin(user?.role)) {
    localStorage.removeItem('vetintel_user');
    localStorage.removeItem('vetintel_token');
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, Component: Dashboard },
      { path: "clinics", Component: ClinicManagement },
      { path: "active-clinics", Component: ActiveClinics },
      { path: "clinics/:id", Component: ClinicDetails },
      { path: "users", Component: UserManagement },
        { path: "announcements", Component: SystemAnnouncements },
      { path: "role-requests", Component: RoleRequests },
      { path: "subscription-plans", Component: SubscriptionPlans },
      { path: "subscription-plans/:planId/subscribers", Component: PlanSubscribers },
      { path: "demo-requests", Component: DemoRequests },
      { path: "reports", element: <Navigate to="/" replace /> },
      { path: "inbox", Component: Inbox },
      { path: "roles", Component: RolesPermissions },
      { path: "audit", Component: AuditTrail },
      { path: "settings", Component: Settings },
    ],
  },
]);
