import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { pageStateStore } from '../utils/pageStateStore.js';
import { canViewFeature } from '../utils/permissionUtils';
import DashboardPage from '../pages/DashboardPage';
import DiseaseMonitoringPage from '../pages/DiseaseMonitoringPage';
import { RiskMonitoringPage } from '../pages/RiskMonitoringPage';
import { ReportsPage } from '../pages/ReportsPage';
import ClinicLayout from '../pages/clinic/ClinicLayout';
import MySchedulePage from '../pages/MySchedulePage';
import PatientIntakesPage from '../pages/PatientIntakesPage';
import PatientRecordsPage from '../pages/PatientRecordsPage';
import PatientQueuePage from '../pages/receptionist/PatientQueuePage';
import AppointmentManagementPage from '../pages/receptionist/AppointmentManagementPage';
import PatientRegistrationPage from '../pages/receptionist/PatientRegistrationPage';
import BillingPage from '../pages/receptionist/BillingPage';
import ClientManagementPage from '../pages/receptionist/ClientManagementPage';
import RemindersPage from '../pages/receptionist/RemindersPage';
import ClinicOverviewPage from '../pages/ClinicOverviewPage';
import UserRoleManagementPage from '../pages/UserRoleManagementPage';
import RolesPermissionsPage from '../pages/RolesPermissionsPage';
import FinancialMonitoringPage from '../pages/FinancialMonitoringPage';
import AuditTrailPage from '../pages/AuditTrailPage';
import ServicesManagementPage from '../pages/ServicesManagementPage';
import SharedInboxPage from '../pages/SharedInboxPage';
import SettingsPage from '../pages/SettingsPage';

const loaded = key => {
  const state = pageStateStore.status(key);
  return state.written && state.value === false;
};
const written = key => pageStateStore.status(key).written;
const pageLoading = file => () => loaded(`pages/${file}.jsx:loading`);

// Run the normal read effects without rendering a visible page so they populate the same page
// snapshots used during navigation. Unmounting each job cleans up its polling.
export default function BackgroundPagePreloader({ user, activePage, canAccessPage }) {
  const jobs = useMemo(() => {
    const allowed = id => canAccessPage(id, user.permissions, user.role);
    const definitions = [
      ['dashboard', DashboardPage, pageLoading('DashboardPage')],
      ['disease', DiseaseMonitoringPage, () => loaded('monitoring:false:loading')],
      ['risk', RiskMonitoringPage, () => loaded('monitoring:true:loading')],
      ['reports', ReportsPage, pageLoading('ReportsPage')],
      ['schedule', MySchedulePage, pageLoading('MySchedulePage')],
      ['patient-intakes', PatientIntakesPage, () => written('pages/PatientIntakesPage.jsx:intakes')],
      ['patient-records', PatientRecordsPage, () => loaded('pages/PatientRecordsPage.jsx:patientRecordsLoading')],
      ['reminders', RemindersPage, pageLoading('receptionist/RemindersPage')],
      ['appointments', AppointmentManagementPage, pageLoading('receptionist/AppointmentManagementPage')],
      ['patient-queue', PatientQueuePage, pageLoading('receptionist/PatientQueuePage')],
      ['billing', BillingPage, pageLoading('receptionist/BillingPage')],
      ['client-mgmt', ClientManagementPage, pageLoading('receptionist/ClientManagementPage')],
      ['patient-registration', PatientRegistrationPage, pageLoading('receptionist/PatientRegistrationPage')],
      ['clinics', ClinicOverviewPage, pageLoading('ClinicOverviewPage')],
      ['users', UserRoleManagementPage, () => written('pages/UserRoleManagementPage.jsx:users')],
      ['roles', RolesPermissionsPage, () => written('pages/RolesPermissionsPage.jsx:roles')],
      ['financial', FinancialMonitoringPage, () => loaded('owner:summary:loading')],
      ['services', ServicesManagementPage, () => loaded('components/SharedServicesCatalog.jsx:loading')],
      ['inventory', ServicesManagementPage, () => loaded('components/SharedInventoryPanel.jsx:loading'), { initialTab: 'inventory' }],
      ['audit', AuditTrailPage, () => written('pages/AuditTrailPage.jsx:logs')],
      ['inbox', SharedInboxPage, () => written('pages/SharedInboxPage.jsx:conversations')],
      ['settings', SettingsPage, () => !canViewFeature(user.permissions, user.role, 'Data Sync Status') || loaded('owner:data-status:loading')],
    ];
    const queue = definitions.filter(([id]) => allowed(id)).map(([id, Component, ready, props]) => ({
      id, page: id, ready, content: <Component user={user} {...props} />,
    }));
    if (allowed('clinic')) {
      const recordsReady = key => () => pageStateStore.status('clinic:loadedRecords').value?.has(key) === true;
      const tabs = [
        ['dashboard', 'Clinic Dashboard', recordsReady('dashboardSummary')],
        ['owners', 'Clinic Record Owners', recordsReady('clients')],
        ['pets', 'Pet Profiles', recordsReady('pets')],
        ['appointments', 'Clinic Record Appointments', recordsReady('appointments')],
        ['visits', 'Visit & Check-up', recordsReady('visits')],
        ['vaccinations', 'Vaccinations', recordsReady('vaccinations')],
        ['plans', 'Treatment Plans', () => written('TreatmentPlansTab:savedPlans:all')],
        ['lab-results', 'Laboratory', () => loaded('LabResultsTab:loading:all')],
        ['inpatient', 'Inpatient Care', () => loaded('InpatientTab:loadingRecords:all')],
        ['consultation', 'Clinic Record Billing', () => loaded('BillingTab:loading:all')],
        ['inventory', 'Inventory Management', () => loaded('components/SharedInventoryPanel.jsx:loading')],
      ];
      // Warm clinic records before the less frequently used management pages.
      queue.splice(4, 0, ...tabs.filter(([, feature]) => canViewFeature(user.permissions, user.role, feature))
        .map(([tab, , ready]) => ({ id: `clinic:${tab}`, page: null, ready,
          content: <ClinicLayout user={user} initialTab={tab} /> })));
    }
    return queue;
  }, [user, canAccessPage]);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [preloadContainer] = useState(() => document.createElement('div'));
  const job = jobs[index];

  useEffect(() => {
    const timer = window.setTimeout(() => setStarted(true), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!started || !job) return undefined;
    const startedAt = Date.now();
    const check = () => {
      if (document.hidden) return;
      if (job.ready() || Date.now() - startedAt > 20000) setIndex(current => current + 1);
    };
    const timer = window.setInterval(check, 250);
    check();
    return () => window.clearInterval(timer);
  }, [started, job]);

  if (!started || !job || job.page === activePage || job.ready()) return null;
  // Keep effect-driven preloading outside the document and its layout.
  return createPortal(job.content, preloadContainer, job.id);
}

BackgroundPagePreloader.propTypes = {
  user: PropTypes.object.isRequired,
  activePage: PropTypes.string.isRequired,
  canAccessPage: PropTypes.func.isRequired,
};
