import Topbar from '../components/Topbar';
import { canViewFeature } from '../utils/permissionUtils';
import { DataSyncPage } from './DataSyncPage';

export default function SettingsPage({ user }) {
  const canViewSync = canViewFeature(user.permissions, user.role, 'Data Sync Status');
  return <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: '#f1f6ef' }}>
    <Topbar user={user} title="Settings" subtitle="Manage clinic settings and review data availability" />
    <div style={{ padding: '24px 28px' }}>
      {canViewSync ? <section aria-labelledby="settings-data-sync-title">
        <h2 id="settings-data-sync-title" style={{ margin: '0 0 8px', color: '#013826', fontSize: 22 }}>Data Sync Status</h2>
        <p style={{ margin: '0 0 20px', color: '#526663', fontSize: 13 }}>Monitor the shared clinic data used by doctors, receptionists, and owners.</p>
        <DataSyncPage user={user} embedded />
      </section> : <p style={{ padding: 20, borderRadius: 12, background: '#fff', color: '#526663' }}>No clinic settings are available for your current permissions.</p>}
    </div>
  </main>;
}
