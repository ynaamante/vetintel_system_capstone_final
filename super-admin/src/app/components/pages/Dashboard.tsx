import {
  Building2,
  Users,
  UserCheck,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Toast } from '../ui/Toast';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function Dashboard() {
  const navigate = useNavigate();
  const [clinicSummary, setClinicSummary] = useState({
    totalRegisteredClinics: 0,
    newClinicsLast30Days: 0,
    activeClinics: 0,
    pendingApprovals: 0,
    suspendedClinics: 0,
  });
  const [roleCounts, setRoleCounts] = useState({
    doctors: 0,
    newDoctorsLast30Days: 0,
    receptionists: 0,
    newReceptionistsLast30Days: 0,
    totalUsers: 0,
    newUsersLast30Days: 0,
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [recentApplications, setRecentApplications] = useState<string[][]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const currentUser = (() => {
    try {
      const u = localStorage.getItem('vetintel_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  })();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const getActivityTitle = (action: string, _table: string) => {
    const lower = action.toLowerCase();
    
    // Clinic operations
    if (lower.includes('clinic') && lower.includes('create')) return 'Clinic Registration';
    if (lower.includes('clinic') && (lower.includes('update') || lower.includes('edit'))) return 'Clinic Updated';
    if (lower.includes('clinic') && lower.includes('delete')) return 'Clinic Removed';
    
    // User operations
    if (lower.includes('user') && lower.includes('create')) return 'User Creation';
    if (lower.includes('user') && (lower.includes('update') || lower.includes('edit'))) return 'User Updated';
    if (lower.includes('user') && lower.includes('delete')) return 'User Removed';
    if (lower.includes('soft delete') || lower.includes('suspend')) return 'Account Suspension';
    
    // Role operations
    if (lower.includes('role') && lower.includes('create')) return 'Role Created';
    if (lower.includes('role') && (lower.includes('update') || lower.includes('edit'))) return 'Role Change';
    if (lower.includes('role') && lower.includes('delete')) return 'Role Removed';
    
    // Permission operations
    if (lower.includes('permission') && lower.includes('create')) return 'Permission Added';
    if (lower.includes('permission') && (lower.includes('update') || lower.includes('edit'))) return 'Permission Updated';
    if (lower.includes('permission') && lower.includes('delete')) return 'Permission Removed';
    if (lower.includes('role_permission') && lower.includes('create')) return 'Role Permission Granted';
    if (lower.includes('role_permission') && lower.includes('delete')) return 'Role Permission Revoked';
    
    // Announcement operations
    if (lower.includes('announcement') && lower.includes('create')) return 'Announcement Published';
    if (lower.includes('announcement') && (lower.includes('update') || lower.includes('edit'))) return 'Announcement Updated';
    if (lower.includes('announcement') && lower.includes('delete')) return 'Announcement Removed';
    
    // Setting operations
    if (lower.includes('setting') && lower.includes('create')) return 'Setting Configured';
    if (lower.includes('setting') && (lower.includes('update') || lower.includes('edit'))) return 'Setting Updated';
    if (lower.includes('setting') && lower.includes('delete')) return 'Setting Removed';
    
    // Fallback mapping
    if (lower.includes('delete')) return 'Deletion';
    if (lower.includes('create')) return 'Creation';
    if (lower.includes('update') || lower.includes('edit')) return 'Update';
    
    return action;
  };

  const getActivityDescription = (activity: any) => {
    const action = activity.action || '';
    const changes = activity.changes || {};
    
    // Helper to extract clean string value
    const cleanValue = (val: any) => {
      if (!val) return 'Item';
      return String(val).replace(/^["']|["']$/g, '').trim();
    };
    
    // Clinic operations
    if (action.includes('Created clinic')) {
      const name = cleanValue(changes.name) || 'Clinic';
      const city = changes.city ? ` in ${cleanValue(changes.city)}` : '';
      return `${name}${city} registered`;
    }
    if (action.includes('Updated clinic')) {
      const name = cleanValue(changes.name) || 'Clinic';
      const fields = [];
      if (changes.address) fields.push('address');
      if (changes.contact_email) fields.push('contact info');
      if (changes.phone) fields.push('phone');
      const updates = fields.length > 0 ? ` (${fields.join(', ')})` : '';
      return `${name} updated${updates}`;
    }

    // User operations
    if (action.includes('Created user')) {
      const first = cleanValue(changes.first_name) || 'User';
      const last = changes.last_name ? ` ${cleanValue(changes.last_name)}` : '';
      return `${first}${last} added`;
    }
    if (action.includes('Updated user')) {
      const first = cleanValue(changes.first_name) || 'User';
      const last = changes.last_name ? ` ${cleanValue(changes.last_name)}` : '';
      const fields = [];
      if (changes.email) fields.push('email');
      if (changes.role_id) fields.push('role');
      if (changes.phone) fields.push('contact');
      const updates = fields.length > 0 ? ` (${fields.join(', ')})` : '';
      return `${first}${last} updated${updates}`;
    }
    if (action.includes('Soft deleted user')) {
      const first = cleanValue(changes.first_name) || 'User';
      const last = changes.last_name ? ` ${cleanValue(changes.last_name)}` : '';
      return `${first}${last} suspended`;
    }
    if (action.includes('Deleted user')) {
      const first = cleanValue(changes.first_name) || 'User';
      const last = changes.last_name ? ` ${cleanValue(changes.last_name)}` : '';
      return `${first}${last} permanently removed`;
    }

    // Role operations
    if (action.includes('Created role')) {
      const name = cleanValue(changes.name) || 'New role';
      return `${name} role created`;
    }
    if (action.includes('Updated role')) {
      const name = cleanValue(changes.name) || 'Role';
      return `${name} role updated`;
    }
    if (action.includes('Deleted role')) {
      const name = cleanValue(changes.name) || 'Role';
      return `${name} role removed`;
    }

    // Permission operations
    if (action.includes('Created permission')) {
      const name = cleanValue(changes.name) || 'Permission';
      const resource = changes.resource ? ` for ${cleanValue(changes.resource)}` : '';
      return `${name}${resource} permission added`;
    }
    if (action.includes('Updated permission')) {
      const name = cleanValue(changes.name) || 'Permission';
      return `${name} permission updated`;
    }
    if (action.includes('Deleted permission')) {
      const name = cleanValue(changes.name) || 'Permission';
      return `${name} permission removed`;
    }

    // Role-Permission mapping
    if (action.includes('Created role_permission')) {
      return `Role permission granted`;
    }
    if (action.includes('Deleted role_permission')) {
      return `Role permission revoked`;
    }

    // Announcement operations
    if (action.includes('Created announcement')) {
      const title = cleanValue(changes.title) || 'Announcement';
      return `"${title}" published`;
    }
    if (action.includes('Updated announcement')) {
      const title = cleanValue(changes.title) || 'Announcement';
      return `"${title}" updated`;
    }
    if (action.includes('Deleted announcement')) {
      const title = cleanValue(changes.title) || 'Announcement';
      return `"${title}" removed`;
    }

    // Setting operations
    if (action.includes('Created setting')) {
      const key = cleanValue(changes.key) || 'Setting';
      return `"${key}" configured`;
    }
    if (action.includes('Updated setting')) {
      const key = cleanValue(changes.key) || 'Setting';
      return `"${key}" updated`;
    }
    if (action.includes('Deleted setting')) {
      const key = cleanValue(changes.key) || 'Setting';
      return `"${key}" removed`;
    }

    // Fallback
    return action.replace(/^[A-Z]/, (character: string) => character.toLowerCase());
  };

  const formatTimeAgo = (isoDate: string) => {
    const date = new Date(isoDate);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('vetintel_token');
        const response = await fetch('/api/dashboard/stats', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) throw new Error('Failed to load dashboard stats');
        const data = await response.json();
        setClinicSummary(data.clinicSummary || {});
        setRoleCounts(data.roleCounts || {});
      } catch (error) {
        console.error(error);
      }
    };

    fetchDashboardData();
  }, []);

  // Fetch recent activity for the Recent Activity card
  useEffect(() => {
    const fetchRecent = async () => {
      try {
       const token = localStorage.getItem('vetintel_token');
      const res = await fetch('/api/dashboard/activity', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
        if (!res.ok) throw new Error('Failed to load recent activity');
        const data = await res.json();
        setRecentActivities(data || []);
      } catch (e) {
        console.error('Failed to fetch recent activity', e);
      }
    };
    fetchRecent();
  }, []);
  

  useEffect(() => {
  const loadRecentApplications = async () => {
    try {
      const token = localStorage.getItem('vetintel_token');

      const response = await fetch('/api/dashboard/clinic-applications', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error('Failed to load recent clinic applications');
      }

      const data = await response.json();

      setRecentApplications(
        (data.applications || []).map((application: any) => [
          application.name || '—',
          application.owner || '—',
          String(application.staff_count || 0),
          application.plan || 'Starter',
          application.created_at
            ? new Date(application.created_at).toLocaleDateString()
            : '—',
          application.status === 'active'
            ? 'Approved'
            : application.status === 'rejected'
              ? 'Needs Information'
              : application.status === 'suspended'
                ? 'Suspended'
                : 'Pending',
        ])
      );
    } catch (error) {
      console.error('Failed to fetch recent clinic applications', error);
    }
  };

  loadRecentApplications();
}, []);

  const formatNewMetric = (count: number, unit: string) => {
    if (count === 0) return `No new ${unit} this month`;
    return `+${count} new ${unit} this month`;
  };

  const statusCards = [
    {
      label: 'Total Registered Clinics',
      value: clinicSummary.totalRegisteredClinics,
      icon: Building2,
      color: 'bg-slate-100 text-slate-900',
      delta: formatNewMetric(clinicSummary.newClinicsLast30Days, 'clinics'),
      deltaColor: clinicSummary.newClinicsLast30Days > 0 ? 'text-emerald-600' : 'text-slate-500',
    },
    {
      label: 'Active Clinics',
      value: clinicSummary.activeClinics,
      icon: CheckCircle,
      color: 'bg-emerald-100 text-emerald-700',
      delta: 'Current active clinic count',
      deltaColor: 'text-slate-500',
    },
    {
      label: 'Pending Approvals',
      value: clinicSummary.pendingApprovals,
      icon: Clock,
      color: 'bg-amber-100 text-amber-700',
      delta: 'As of today',
      deltaColor: 'text-slate-500',
    },
    {
      label: 'Suspended Clinics',
      value: clinicSummary.suspendedClinics,
      icon: AlertCircle,
      color: 'bg-red-100 text-red-700',
      delta: 'As of today',
      deltaColor: 'text-slate-500',
    },
  ];

  const summaryCards = [
    {
      label: 'Total Doctors',
      value: roleCounts.doctors,
      icon: UserCheck,
      color: 'bg-violet-100 text-violet-700',
      delta: formatNewMetric(roleCounts.newDoctorsLast30Days, 'doctors'),
      deltaColor: roleCounts.newDoctorsLast30Days > 0 ? 'text-emerald-600' : 'text-slate-500',
    },
    {
      label: 'Total Receptionists',
      value: roleCounts.receptionists,
      icon: Users,
      color: 'bg-indigo-100 text-indigo-700',
      delta: formatNewMetric(roleCounts.newReceptionistsLast30Days, 'receptionists'),
      deltaColor: roleCounts.newReceptionistsLast30Days > 0 ? 'text-emerald-600' : 'text-slate-500',
    },
    {
      label: 'Total Platform Users',
      value: roleCounts.totalUsers,
      icon: Building2,
      color: 'bg-cyan-100 text-cyan-700',
      delta: formatNewMetric(roleCounts.newUsersLast30Days, 'users'),
      deltaColor: roleCounts.newUsersLast30Days > 0 ? 'text-emerald-600' : 'text-slate-500',
    },
  ];

  const recentRoleRequests = [
  ['No role requests yet', '—', '—', '—', 'Pending'],
];
  const activityRows = recentActivities.length > 0
  ? recentActivities.slice(0, 5)
  : [
      {
        id: 'no-activity',
        action: 'No recent activity',
        entity_type: 'system',
        changes: { name: 'New activity will appear here.' },
        created_at: new Date().toISOString(),
        time: '—',
      },
    ];
  const statusClass = (status: string) => status === 'Approved' ? 'bg-[#d8f7e9] text-[#078c63]' : status === 'Under Review' ? 'bg-[#dff2fc] text-[#16759f]' : status === 'Needs Information' ? 'bg-[#eee8ff] text-[#7044b6]' : 'bg-[#fff1c9] text-[#c98200]';

  return (
    <div className="p-5 space-y-5 bg-[#fafbf8] min-h-full">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
        {[
          { label: 'Total Registered Clinics', value: clinicSummary.totalRegisteredClinics, delta: `+${clinicSummary.newClinicsLast30Days} this month`, color: 'bg-[#e7f4ec] text-[#086b50]' },
          { label: 'Active Clinics', value: clinicSummary.activeClinics, delta: '+5 this week', color: 'bg-[#d8f7e9] text-[#079669]' },
          { label: 'Pending Applications', value: clinicSummary.pendingApprovals, delta: '3 urgent', color: 'bg-[#fff1c9] text-[#d98200]' },
          { label: 'Pending Role Requests', value: 5, delta: '2 new today', color: 'bg-[#eee8ff] text-[#7b3fe4]' },
          { label: 'Active Subscriptions', value: 138, delta: '97% retention', color: 'bg-[#e1f3ff] text-[#168fc5]' },
          { label: 'Demo Requests', value: 14, delta: '6 uncontacted', color: 'bg-[#ffe8f2] text-[#d52e7b]' },
        ].map((metric) => (
          <div key={metric.label} className="bg-white rounded-lg border border-[#d4e3d7] p-4 shadow-none">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-sm text-[#526B62]">{metric.label}</p><p className="text-3xl font-semibold text-[#172b24] mt-2">{metric.value}</p><p className="text-xs text-[#086b50] mt-1">{metric.delta}</p></div>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${metric.color}`}><span className="w-2 h-2 rounded-full bg-current" /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.8fr_1fr] gap-3">
        <div className="bg-white rounded-lg border border-[#d4e3d7] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#d4e3d7]"><h2 className="text-base font-semibold text-[#172b24]">Recent Clinic Applications</h2><button onClick={() => navigate('/clinics')} className="text-sm text-[#086b50]">View all</button></div>
        <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-[#e7f4ec]"><tr>{['Clinic Name', 'Owner', 'Staff', 'Plan', 'Date', 'Status'].map((heading) => <th className="px-3 py-2 text-xs font-semibold text-[#526B62]" key={heading}>{heading}</th>)}</tr></thead><tbody>{recentApplications.map((row) => <tr className="border-t border-[#e3ecfb]" key={row[0]}>{row.map((value, index) => <td className="px-3 py-3 text-sm text-[#526B62]" key={index}>{index === row.length - 1 ? <span className={`rounded-full px-2 py-1 ${statusClass(value)}`}>{value}</span> : value}</td>)}</tr>)}</tbody></table></div>
        </div>
        <div className="bg-white rounded-lg border border-[#d4e3d7] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#d4e3d7]"><h2 className="text-base font-semibold text-[#172b24]">Platform Activity</h2></div>
        <div>{activityRows.map((activity) => <div className="flex gap-3 px-4 py-3 border-b border-[#d4d4d4]" key={activity.id}><span className="mt-1.5 w-2 h-2 rounded-full bg-[#086b50] shrink-0" /><div className="flex-1"><p className="text-sm font-semibold text-[#172b24]">{recentActivities.length > 0 ? getActivityTitle(activity.action, activity.entity_type) : activity.action}</p><p className="text-xs text-[#526B62]">{recentActivities.length > 0 ? getActivityDescription(activity) : activity.changes.name}</p></div><span className="text-xs text-[#a9d6b7]">{activity.time || formatTimeAgo(activity.created_at)}</span></div>)}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#d4e3d7] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#d4e3d7]"><h2 className="text-base font-semibold text-[#172b24]">Recent Role Requests</h2><button onClick={() => navigate('/role-requests')} className="text-sm text-[#086b50]">View all</button></div>
      <table className="w-full text-left"><thead className="bg-[#e7f4ec]"><tr>{['Clinic', 'Requested Role', 'Users', 'Date', 'Status'].map((heading) => <th className="px-3 py-2 text-xs font-semibold text-[#526B62]" key={heading}>{heading}</th>)}</tr></thead><tbody>{recentRoleRequests.map((row) => <tr className="border-t border-[#e3ecfb]" key={row[0] + row[1]}>{row.map((value, index) => <td className="px-3 py-3 text-sm text-[#526B62]" key={index}>{index === row.length - 1 ? <span className={`rounded-full px-2 py-1 ${statusClass(value)}`}>{value}</span> : value}</td>)}</tr>)}</tbody></table>
      </div>

      <div className="hidden">
        {statusCards.map((card) => <span key={card.label}>{card.value}</span>)}
        {summaryCards.map((card) => <span key={card.label}>{card.value}</span>)}
      </div>
      <div className="hidden">
        {isSuperAdmin && (
          <button onClick={() => setShowClearConfirm(true)}>Clear Recent</button>
        )}
      </div>
      <div className="hidden">
      </div>
      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 text-center">Clear Recent Activity</h2>
              <p className="text-sm text-gray-600 text-center mt-2">This will archive recent activity logs. Are you sure?</p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('vetintel_token');
                      const headers: any = {};
                      if (token) headers.Authorization = `Bearer ${token}`;
                      const res = await fetch('/api/dashboard/activity', { method: 'DELETE', headers });
                      if (!res.ok) throw new Error('Failed to clear recent activity');
                      setRecentActivities([]);
                      setShowClearConfirm(false);
                      setToast('Recent activity archived');
                      setTimeout(() => setToast(null), 3000);
                    } catch (e) {
                      console.error(e);
                      setToast('Failed to clear activity');
                      setTimeout(() => setToast(null), 3000);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
