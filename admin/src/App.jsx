import { useEffect, useState } from 'react';
import './styles/global.css';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DiseaseMonitoringPage from './pages/DiseaseMonitoringPage';
import ClinicLayout from './pages/clinic/ClinicLayout';
import MySchedulePage from './pages/MySchedulePage';
import PatientIntakesPage from './pages/PatientIntakesPage';
import PatientRecordsPage from './pages/PatientRecordsPage';
import PlaceholderPage from './pages/PlaceholderPage';
import PatientQueuePage from './pages/receptionist/PatientQueuePage';
import AppointmentManagementPage from './pages/receptionist/AppointmentManagementPage';
import PatientRegistrationPage from './pages/receptionist/PatientRegistrationPage';
import BillingPage from './pages/receptionist/BillingPage';
import ClientManagementPage from './pages/receptionist/ClientManagementPage';
import RemindersPage from './pages/receptionist/RemindersPage';
import { RiskMonitoringPage } from './pages/RiskMonitoringPage';
import { CommunityAnalyticsPage } from './pages/CommunityAnalyticsPage';
import { ReportsPage } from './pages/ReportsPage';
import { DataSyncPage } from './pages/DataSyncPage';
import ClinicOverviewPage from './pages/ClinicOverviewPage';
import UserRoleManagementPage from './pages/UserRoleManagementPage';
import RolesPermissionsPage from './pages/RolesPermissionsPage';
import FinancialMonitoringPage from './pages/FinancialMonitoringPage';
import AuditTrailPage from './pages/AuditTrailPage';
import InventoryManagementPage from './pages/InventoryManagementPage';
import ServicesManagementPage from './pages/ServicesManagementPage';
import SharedInboxPage from './pages/SharedInboxPage';
import { Icons } from './icons';
import { canViewFeature } from './utils/permissionUtils';
import { subscribeToNotifications } from './utils/notifications';

const DEDICATED = [
  'dashboard',
  'disease',
  'clinic',
  'schedule',
  'patient-intakes',
  'patient-queue',
  'appointments',
  'patient-registration',
  'patient-records',
  'billing',
  'client-mgmt',
  'reminders',
  'risk',
  'analytics',
  'reports',
  'sync',
  'clinics',
  'users',
  'roles',
  'financial',
  'inventory',
  'services',
  'audit',
  'inbox',
];

const PAGE_FEATURE_MAP = {
  dashboard: 'Intelligence Dashboard',
  disease: 'Disease Monitoring',
  clinic: 'Pet Profiles',
  schedule: 'My Schedule',
  'patient-intakes': 'Patient Intakes',
  'patient-queue': 'Patient Queue',
  appointments: 'Appointment Management',
  'patient-registration': 'New Patient Registration',
  'patient-records': 'Patient Records',
  billing: 'Billing & Payments',
  'client-mgmt': 'Client Management',
  reminders: 'Due Dates & Reminders',
  risk: 'Risk Monitoring',
  analytics: 'Community Analytics',
  reports: 'Reports',
  sync: 'Data Sync Status',
  clinics: 'Clinic Overview',
  users: 'User & Role Management',
  roles: 'User & Role Management',
  financial: 'Financial Monitoring',
  inventory: 'Inventory Management',
  services: 'Services Management',
  audit: 'Audit Trail',
  inbox: 'Shared Inbox',
};

const normalizeRoleName = (role) =>
  String(role || '').trim().toLowerCase().replace(/[-\s]+/g, '_');

const isDoctorRole = (role) => ['doctor', 'assistant_doctor', 'veterinarian'].includes(normalizeRoleName(role));

const getFirstAllowedPage = (permissions, role) => {
  const allPages = Object.keys(PAGE_FEATURE_MAP);

  if (isDoctorRole(role)) return 'schedule';

  for (const page of allPages) {
    const feature = PAGE_FEATURE_MAP[page];

    if (feature && canViewFeature(permissions, role, feature)) {
      return page;
    }
  }

  return 'dashboard';
};

const canAccessPage = (pageKey, permissions, role) => {
  const normalizedRole = normalizeRoleName(role);
  if (normalizedRole === 'owner' && ['inventory', 'services'].includes(pageKey)) return true;
  if (pageKey === 'schedule') return isDoctorRole(role);
  if (['patient-intakes', 'patient-records'].includes(pageKey)) return isDoctorRole(role);
  if (['owner', 'doctor', 'receptionist'].includes(normalizedRole) && pageKey === 'inbox') return true;
  const feature = PAGE_FEATURE_MAP[pageKey];
  return feature ? canViewFeature(permissions, role, feature) : false;
};

const loadRolePermissions = async (roleName, token) => {
  if (!roleName) return null;

  const apiUrl = import.meta.env.VITE_API_URL || '';

  try {
    const response = await fetch(`${apiUrl}/roles`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) return null;

    const roles = await response.json();
    const normalizedRole = normalizeRoleName(roleName);

    return (
      roles.find((role) => {
        const candidate = normalizeRoleName(role.name);

        return (
          candidate === normalizedRole ||
          candidate === normalizedRole.replace(/[-\s]+/g, '_')
        );
      })?.permissions ?? null
    );
  } catch (error) {
    console.error('Failed to load role permissions', error);
    return null;
  }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [clinicInitialTab, setClinicInitialTab] = useState('dashboard');
  const [clinicInitialInvoiceId, setClinicInitialInvoiceId] = useState(null);
  const [inboxPatientRequest, setInboxPatientRequest] = useState(null);
  const [inboxConversationRequest, setInboxConversationRequest] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => (
    typeof window !== 'undefined' && window.innerWidth <= 900
  ));
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => subscribeToNotifications(notification => {
    setToast(notification);
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }), []);

  useEffect(() => {
    if (page !== 'clinic') {
      setClinicInitialTab('dashboard');
      setClinicInitialInvoiceId(null);
    }
  }, [page]);

  useEffect(() => {
    const toggleSidebar = () => setSidebarCollapsed(current => !current);
    window.addEventListener('vetintel-toggle-sidebar', toggleSidebar);
    return () => window.removeEventListener('vetintel-toggle-sidebar', toggleSidebar);
  }, []);

  useEffect(() => {
    if (page !== 'patient-records') setInboxPatientRequest(null);
  }, [page]);

  useEffect(() => {
    const token = localStorage.getItem('vetintel_token');

    if (!token) {
      return;
    }

    const storedUser = localStorage.getItem('vetintel_user');

    if (storedUser) {
      try {
        JSON.parse(storedUser);
      } catch {
        localStorage.removeItem('vetintel_user');
        localStorage.removeItem('vetintel_token');
        return;
      }
    }

    const apiUrl = import.meta.env.VITE_API_URL || '';

    fetch(`${apiUrl}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unauthorized');
        return response.json();
      })
      .then((me) => {
        const userWithToken = { ...me, token };

        setUser(userWithToken);
        setPermissionsLoaded(false);

        if (me.role) {
          loadRolePermissions(me.role, token)
            .then((permissions) => {
              if (permissions) {
                const updated = { ...userWithToken, permissions };

                setUser(updated);
                localStorage.setItem('vetintel_user', JSON.stringify(updated));
                setPage(getFirstAllowedPage(permissions, me.role));
              }

              setPermissionsLoaded(true);
            })
            .catch(() => {
              setPermissionsLoaded(true);
            });
        } else {
          setPermissionsLoaded(true);
          localStorage.setItem('vetintel_user', JSON.stringify(me));
        }
      })
      .catch(() => {
        localStorage.removeItem('vetintel_user');
        localStorage.removeItem('vetintel_token');
        setUser(null);
        setPermissionsLoaded(true);
      });
  }, []);

  function handleLogin(userData) {
    const { token, ...rest } = userData;
    const userWithToken = { ...rest, token };

    localStorage.setItem('vetintel_token', token);
    localStorage.setItem('vetintel_user', JSON.stringify(rest));

    setUser(userWithToken);
    setPermissionsLoaded(false);
    setPage('dashboard');

    if (rest.role) {
      loadRolePermissions(rest.role, token)
        .then((permissions) => {
          if (permissions) {
            const updated = { ...userWithToken, permissions };

            setUser(updated);
            localStorage.setItem('vetintel_user', JSON.stringify(updated));
            setPage(getFirstAllowedPage(permissions, rest.role));
          }

          setPermissionsLoaded(true);
        })
        .catch(() => {
          setPermissionsLoaded(true);
        });
    } else {
      setPermissionsLoaded(true);
    }
  }

  function handleLogout() {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Ignore unavailable storage.
    }

    setUser(null);
    setPage('dashboard');

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((registration) => registration.unregister()))
        .catch(() => {});
    }

    try {
      window.location.replace(window.location.origin + window.location.pathname);
    } catch {
      window.location.reload();
    }
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (!permissionsLoaded) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: '#64748b',
        }}
      >
        Loading permissions…
      </div>
    );
  }

  const currentPage = canAccessPage(page, user.permissions || null, user.role)
    ? page
    : getFirstAllowedPage(user.permissions || null, user.role);

  if (currentPage !== page) {
    setPage(currentPage);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        active={page}
        setPage={setPage}
        user={user}
        onLogout={handleLogout}
        collapsed={sidebarCollapsed}
        onNavigate={() => {
          if (typeof window !== 'undefined' && window.innerWidth <= 900) setSidebarCollapsed(true);
        }}
      />

      <main className={`admin-content ${page === 'inbox' ? 'inbox-content' : ''}`}>
        {page === 'dashboard' && <DashboardPage user={user} />}
        {page === 'disease' && <DiseaseMonitoringPage user={user} />}
        {page === 'clinic' && <ClinicLayout user={user} initialTab={clinicInitialTab} initialInvoiceId={clinicInitialInvoiceId} onNavigate={setPage} />}
        {page === 'schedule' && <MySchedulePage user={user} />}
        {page === 'patient-intakes' && <PatientIntakesPage user={user} />}

        {page === 'patient-queue' && <PatientQueuePage user={user} />}
        {page === 'appointments' && <AppointmentManagementPage user={user} />}
        {page === 'patient-registration' && <PatientRegistrationPage user={user} />}
        {page === 'billing' && <BillingPage user={user} />}
        {page === 'client-mgmt' && <ClientManagementPage user={user} />}
        {page === 'reminders' && <RemindersPage user={user} />}
        {page === 'patient-records' && <PatientRecordsPage
          user={user}
          onNavigate={(nextPage, conversation) => {
            if (nextPage === 'inbox') setInboxConversationRequest(conversation);
            if (nextPage === 'clinic') {
              setClinicInitialTab(conversation?.tab || 'dashboard');
              setClinicInitialInvoiceId(conversation?.invoiceId || null);
            }
            setPage(nextPage);
          }}
          initialPatient={inboxPatientRequest}
        />}

        {page === 'risk' && <RiskMonitoringPage user={user} />}
        {page === 'analytics' && <CommunityAnalyticsPage user={user} />}
        {page === 'reports' && <ReportsPage user={user} />}
        {page === 'sync' && <DataSyncPage user={user} />}

        {page === 'clinics' && <ClinicOverviewPage user={user} onNavigate={setPage} />}
        {page === 'users' && <UserRoleManagementPage user={user} />}
        {page === 'roles' && <RolesPermissionsPage user={user} />}
        {page === 'financial' && <FinancialMonitoringPage user={user} />}
        {page === 'inventory' && <InventoryManagementPage user={user} />}
        {page === 'services' && <ServicesManagementPage user={user} />}
        {page === 'audit' && <AuditTrailPage user={user} />}
        {page === 'inbox' && <SharedInboxPage
          user={user}
          initialConversationRequest={inboxConversationRequest}
          onNavigate={(nextPage, patient) => {
            if (nextPage === 'patient-records') setInboxPatientRequest(patient);
            setPage(nextPage);
          }}
        />}

        {!DEDICATED.includes(page) && <PlaceholderPage user={user} />}
      </main>
      {toast && (
        <div role="status" aria-live="polite" style={{
          position: 'fixed', top: 24, right: 24, zIndex: 2000, display: 'flex',
          alignItems: 'center', gap: 10, minWidth: 300, maxWidth: 420, padding: '16px 18px',
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(15,23,42,.14)', color: '#111827',
        }}>
          <span style={{ width: 17, height: 17, display: 'flex', color: '#111827' }}>{Icons.check}</span>
          <div>
            <strong style={{ display: 'block', fontSize: '.86rem' }}>{toast.title}</strong>
            {toast.text && <span style={{ display: 'block', marginTop: 3, color: '#475569', fontSize: '.78rem' }}>{toast.text}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
