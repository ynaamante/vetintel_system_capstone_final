import { apiFetch as fetch, clearApiCache } from './utils/apiFetch.js';
import { clearPageState } from './utils/pageStateStore.js';
import BackgroundPagePreloader from './components/BackgroundPagePreloader';
import { watchClinicEvents } from './utils/clinicEvents';
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
import SettingsPage from './pages/SettingsPage';
import { ReportsPage } from './pages/ReportsPage';
import ClinicOverviewPage from './pages/ClinicOverviewPage';
import UserRoleManagementPage from './pages/UserRoleManagementPage';
import RolesPermissionsPage from './pages/RolesPermissionsPage';
import FinancialMonitoringPage from './pages/FinancialMonitoringPage';
import AuditTrailPage from './pages/AuditTrailPage';
import ServicesManagementPage from './pages/ServicesManagementPage';
import SharedInboxPage from './pages/SharedInboxPage';
import { Icons } from './icons';
import { canViewFeature } from './utils/permissionUtils';
      <main key={JSON.stringify([user.token, user.id, user.clinic_id, user.role, user.permissions])} className={`admin-content ${ownerContent ? 'owner-content' : ''} ${ownerContent || staffContent ? 'themed-page-headers' : ''} ${page === 'inbox' ? 'inbox-content' : ''} ${page === 'clinics' ? 'owner-overview-content' : ''}`}>
        {page === 'dashboard' && <DashboardPage user={user} initialFilters={monitoringFilters} onFiltersChange={setMonitoringFilters} onNavigate={navigateSurveillance} />}
        {page === 'disease' && <DiseaseMonitoringPage user={user} initialFilters={monitoringFilters} onFiltersChange={setMonitoringFilters} onNavigate={navigateSurveillance} />}
        {page === 'clinic' && <ClinicLayout user={user} initialTab={clinicInitialTab} initialInvoiceId={clinicInitialInvoiceId} onNavigate={(nextPage, context) => { if (nextPage === 'patient-records') setInboxPatientRequest(context); if (nextPage === 'clinic') { setClinicInitialTab(context?.tab || 'dashboard'); setClinicInitialInvoiceId(context?.invoiceId || null); } setPage(nextPage); }} />}
        {page === 'schedule' && <MySchedulePage user={user} />}
        {page === 'patient-intakes' && <PatientIntakesPage user={user} />}

        {page === 'patient-queue' && <PatientQueuePage user={user} />}
        {page === 'appointments' && <AppointmentManagementPage user={user} />}
        {page === 'patient-registration' && <PatientRegistrationPage user={user} />}
        {page === 'billing' && <BillingPage user={user} />}
        {page === 'client-mgmt' && <ClientManagementPage user={user} />}
        {page === 'reminders' && <RemindersPage user={user} onNavigate={(nextPage, context) => { if (nextPage === 'patient-records') setInboxPatientRequest(context); setPage(nextPage); }} />}
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

        {page === 'risk' && <RiskMonitoringPage user={user} initialFilters={monitoringFilters} onFiltersChange={setMonitoringFilters} onNavigate={navigateSurveillance} />}
        {page === 'settings' && <SettingsPage user={user} />}
        {page === 'reports' && <ReportsPage user={user} initialFilters={monitoringFilters} generatedReports={generatedReports} onReportsChange={setGeneratedReports} />}

        {page === 'clinics' && <ClinicOverviewPage user={user} onNavigate={setPage} />}
        {page === 'users' && <UserRoleManagementPage user={user} />}
        {page === 'roles' && <RolesPermissionsPage user={user} />}
        {page === 'financial' && <FinancialMonitoringPage user={user} />}
        {['services', 'inventory'].includes(page) && (
          <ServicesManagementPage
            user={user}
            initialTab={page === 'inventory' ? 'inventory' : 'services'}
            setPage={setPage}
          />
        )}
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
      <BackgroundPagePreloader
        key={JSON.stringify([user.token, user.id, user.clinic_id, user.role, user.permissions])}
        user={user} activePage={page} canAccessPage={canAccessPage}
      />
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
