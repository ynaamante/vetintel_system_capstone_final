import { Icons } from '../icons';
import { canViewFeature } from '../utils/permissionUtils';

// All available features organized by section
const ALL_NAV_ITEMS = [
  // Disease Intelligence
  { id: 'dashboard', label: 'Dashboard',              icon: 'grid',     section: 'Disease Intelligence', checkPermission: 'Intelligence Dashboard' },
  { id: 'disease',   label: 'Disease Monitoring',     icon: 'activity', dot: true },
  { id: 'risk',      label: 'Risk Monitoring',         icon: 'shield'   },
  { id: 'analytics', label: 'Community Analytics',    icon: 'users'    },
  { id: 'reports',   label: 'Reports',                icon: 'file'     },
  { id: 'sync',      label: 'Data Sync Status',       icon: 'refresh'  },
  // Clinic Management
  { id: 'clinics',   label: 'Clinic Overview',         icon: 'building', section: 'Clinic Management' },
  { id: 'users',     label: 'User Management',         icon: 'users',   checkPermission: 'User & Role Management' },
  { id: 'roles',     label: 'Roles & Permissions',     icon: 'lock',    checkPermission: 'User & Role Management' },
  { id: 'financial', label: 'Financial Monitoring',   icon: 'dollar'   },
  { id: 'inventory', label: 'Inventory Management',   icon: 'archive', ownerOnly: true },
  { id: 'services',  label: 'Services Management',    icon: 'settings', ownerOnly: true },
  { id: 'audit',     label: 'Audit Trail',            icon: 'list'     },
  // Clinic Records
  { id: 'schedule',  label: 'My Schedule',             icon: 'calendar', section: 'Clinical Records', doctorOnly: true },
  { id: 'patient-intakes', label: 'Patient Intakes',   icon: 'clipboard', doctorOnly: true },
  { id: 'clinic',    label: 'Local Clinic Records',   icon: 'building', checkPermission: 'Pet Profiles' },
  { id: 'patient-records', label: 'Patient Records',   icon: 'file', doctorOnly: true },
  // Operations
  { id: 'patient-registration', label: 'New Patient Registration', icon: 'clipboard', section: 'Operations', receptionistOnly: true },
  { id: 'appointments', label: 'Appointment Management', icon: 'calendar', receptionistOnly: true },
  { id: 'patient-queue', label: 'Patient Queue', icon: 'users', receptionistOnly: true },
  { id: 'billing', label: 'Billing & Payments', icon: 'dollar', receptionistOnly: true },
  { id: 'client-mgmt', label: 'Client Management', icon: 'users', receptionistOnly: true },
  { id: 'reminders', label: 'Due Dates & Reminders', icon: 'bell', receptionistOnly: true },
];

const isDoctorRole = role => ['doctor', 'assistant_doctor', 'veterinarian'].includes(String(role || '').trim().toLowerCase().replace(/[-\s]+/g, '_'));

export default function Sidebar({ active, setPage, user, onLogout, collapsed = false, onNavigate }) {
  const rawRole = String(user.role || '').trim().toLowerCase();
  const roleName = rawRole.replace(/[-\s]+/g, '_');

  const permissions = user.permissions || {};

  const canAccessPage = (item) => {
    if (roleName === 'super_admin') return true;
    if (item.receptionistOnly && roleName !== 'receptionist') return false;
    if (item.doctorOnly) return isDoctorRole(user.role);
    if (item.ownerOnly && roleName === 'owner') return true;
    if (item.sharedInbox && ['owner', 'doctor', 'receptionist'].includes(roleName)) return true;
    // Use custom checkPermission field if specified, otherwise use label
    const featureName = item.checkPermission || item.label;
    return canViewFeature(permissions, user.role, featureName);
  };

  // Filter navigation items ONLY by permissions, not by role title
  const NAV = ALL_NAV_ITEMS.filter((item) => canAccessPage(item));
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 900;
  const navigate = (page) => {
    setPage(page);
    onNavigate?.();
  };

  return (
    <>
      {isMobile && !collapsed && <div style={s.backdrop} onClick={onNavigate} />}
      <div className="admin-sidebar" style={{ ...s.sidebar, ...(collapsed ? s.sidebarCollapsed : {}), ...(isMobile ? s.mobileSidebar : {}), ...(!collapsed && isMobile ? s.mobileSidebarOpen : {}) }}>
      <div style={{ ...s.brandRow, ...(collapsed ? s.brandRowCollapsed : {}) }}>
        {collapsed ? (
          <button
            type="button"
            className="sidebar-brand-toggle"
            style={s.brandToggle}
            onClick={() => window.dispatchEvent(new CustomEvent('vetintel-toggle-sidebar'))}
            aria-label="Expand navigation menu"
            title="Expand navigation menu"
          >
            <span style={{ ...s.brand, ...s.brandCollapsed }}>V</span>
          </button>
        ) : (
          <>
            <div style={s.brand}>VetIntel</div>
            <button
              type="button"
              style={s.menuButton}
              onClick={() => window.dispatchEvent(new CustomEvent('vetintel-toggle-sidebar'))}
              aria-label="Collapse navigation menu"
              title="Collapse navigation menu"
            >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            </button>
          </>
        )}
      </div>

      {!collapsed && (
        <div style={s.clinicCard}>
          <div style={s.clinicName}>{user.clinic_name || 'Clinic not assigned'}</div>
          <div style={s.clinicMeta}>
            <span>{user.clinic_id ? `CLI-${String(user.clinic_id).padStart(3, '0')}` : 'No clinic ID'}</span>
            <span style={s.status}>
              <span style={s.statusDot} />
              Connected
            </span>
          </div>
        </div>
      )}

      {NAV.map(item => (
        <div
          key={item.id}
          className={item.id === 'schedule' ? 'sidebar-clinical-section' : undefined}
        >
          {item.section && !collapsed && <div style={s.section}>{item.section}</div>}
          <div
            className={`sidebar-nav-item${active === item.id ? ' active' : ''}`}
            style={{ ...s.item, ...(collapsed ? s.itemCollapsed : {}), ...(active === item.id ? s.itemActive : {}) }}
            onClick={() => navigate(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <span className={`sidebar-icon${item.dot ? ' sidebar-alert-icon' : ''}`} style={{ ...s.icon, ...(collapsed ? s.iconCollapsed : {}) }}>
              {Icons[item.icon]}
              {item.dot && collapsed && <span style={s.collapsedAlertDot} />}
            </span>
            {!collapsed && <span>{item.label}</span>}
            {item.dot && <span className="sidebar-alert-count" style={collapsed ? s.collapsedAlertCount : s.alertCount}>2 alerts</span>}
          </div>
        </div>
      ))}

      <div style={{ flex: 1 }} />

      {['owner', 'doctor', 'receptionist'].includes(roleName) && (
        <div
          className={`sidebar-nav-item${active === 'inbox' ? ' active' : ''}`}
          style={{ ...s.item, ...(collapsed ? s.itemCollapsed : {}), ...s.inboxItem, ...(active === 'inbox' ? s.itemActive : {}) }}
          onClick={() => navigate('inbox')}
          title={collapsed ? 'Shared Inbox' : undefined}
        >
          <span className="sidebar-icon sidebar-inbox-icon" style={{ ...s.icon, ...(collapsed ? s.iconCollapsed : {}) }}>
            {Icons.mail}
            {collapsed && <span style={s.collapsedInboxCount}>3</span>}
          </span>
          {!collapsed && <span>Shared Inbox</span>}
          {!collapsed && <span style={s.inboxCount}>3</span>}
        </div>
      )}

      <div style={s.actions}>
        <div className="sidebar-action" style={s.action}>
          <span style={s.icon}>{Icons.settings}</span>
          {!collapsed && 'Settings'}
        </div>
        {collapsed && (
          <button type="button" className="sidebar-action" style={s.action} onClick={onLogout} aria-label="Sign out" title="Sign out">
            <span style={s.icon}>{Icons.logout}</span>
          </button>
        )}
      </div>
      {!collapsed && (
        <div style={s.userBox}>
          <div style={s.avatar}>
            {String(user.name || 'V')
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part.charAt(0).toUpperCase())
              .join('')}
          </div>
          <div style={s.userDetails}>
            <div style={s.userName}>{user.name}</div>
            <div style={s.userRole}>{user.role}</div>
          </div>
          <button type="button" className="sidebar-action" style={s.logoutButton} onClick={onLogout} aria-label="Sign out" title="Sign out">
            {Icons.logout}
          </button>
        </div>
      )}
    </div>
    </>
  );
}

const s = {
  sidebar:    { width: 264, minHeight: '100vh', background: '#004f43', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', padding: '0 13px', color: '#fff', position: 'relative', isolation: 'isolate' },
  sidebarCollapsed: { width: 66, padding: '0 6px' },
  mobileSidebar: { position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 1000, transition: 'transform .2s ease' },
  mobileSidebarOpen: { width: 264, boxShadow: '8px 0 24px rgba(6,72,56,.25)' },
  backdrop: { position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(15,23,42,.42)' },
  brand:      { padding: 0, fontFamily: "'DM Sans', sans-serif", fontSize: '1.1rem', fontWeight: 700, color: '#fff', letterSpacing: '-.01em', lineHeight: 1, whiteSpace: 'nowrap' },
  brandCollapsed: { fontSize: '1rem', letterSpacing: 0 },
  brandRow:   { display: 'flex', alignItems: 'center', gap: 10, minHeight: 70, padding: '10px 10px' },
  brandRowCollapsed: { justifyContent: 'center', gap: 0, minHeight: 98, padding: '14px 0 20px', marginBottom: 1, borderBottom: '1px solid rgba(255,255,255,.2)' },
  brandToggle: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, padding: 0, border: 0, borderRadius: 10, background: 'transparent', cursor: 'pointer' },
  brandIcon: { width: 40, height: 40, borderRadius: 10, background: 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, flexShrink: 0 },
  brandIconCollapsed: { width: 34, height: 34, borderRadius: 9, padding: 8 },
  menuButton: { width: 26, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 7, background: 'transparent', color: '#fff', cursor: 'pointer', marginLeft: 'auto' },
  clinicCard: { minHeight: 54, padding: '8px 10px', marginBottom: 4, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, overflow: 'hidden' },
  clinicName: { color: '#fff', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  clinicMeta: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, color: 'rgba(255,255,255,.94)', fontSize: 12, whiteSpace: 'nowrap' },
  status:     { display: 'inline-flex', alignItems: 'center', gap: 5, color: '#eafff6', fontSize: 12 },
  statusDot:  { width: 8, height: 8, borderRadius: '50%', background: '#55e595', boxShadow: '0 0 0 3px rgba(85,229,149,.18)', flexShrink: 0 },
  section:    { padding: '13px 10px 5px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.95)', letterSpacing: '.08em', textTransform: 'uppercase' },
  item:       { display: 'flex', alignItems: 'center', gap: 12, minHeight: 42, padding: '9px 11px', margin: '1px 0', borderRadius: 11, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', position: 'relative', whiteSpace: 'nowrap', transition: 'background .15s ease, color .15s ease, transform .15s ease' },
  itemCollapsed: { justifyContent: 'center', gap: 0, minHeight: 41, padding: 6, margin: '0 0 0' },
  itemActive: { background: '#39a98f', color: '#fff', boxShadow: 'none', fontWeight: 700 },
  inboxItem: { margin: '0 0 8px', color: '#fff' },
  inboxCount: { marginLeft: 'auto', minWidth: 21, height: 21, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 11, background: '#f45128', color: '#fff', fontSize: 11, fontWeight: 700 },
  icon:       { width: 18, height: 18, flexShrink: 0, display: 'flex', alignItems: 'center', opacity: 1 },
  iconCollapsed: { width: 20, height: 20, justifyContent: 'center' },
  alertCount: { marginLeft: 'auto', padding: '2px 7px', borderRadius: 12, background: '#fff', color: '#bd3e1f', fontSize: 11, fontWeight: 700, lineHeight: 1.5 },
  collapsedAlertCount: { position: 'absolute', zIndex: 1, top: -10, left: '50%', transform: 'translateX(-50%)', padding: '1px 4px', borderRadius: 8, background: '#fff', color: '#bd3e1f', fontSize: 7, fontWeight: 700, lineHeight: 1.3, whiteSpace: 'nowrap' },
  collapsedAlertDot: { display: 'none' },
  collapsedInboxCount: { position: 'absolute', top: -4, right: -5, minWidth: 12, height: 12, padding: '0 2px', borderRadius: 7, background: '#f45128', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, lineHeight: 1 },
  userBox:    { minHeight: 56, padding: '7px 8px', marginBottom: 11, display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, background: 'rgba(255,255,255,.12)' },
  avatar: { width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 },
  userDetails: { minWidth: 0, flex: 1 },
  userName:   { width: 'fit-content', maxWidth: '100%', fontSize: 13, color: '#fff', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userRole:   { fontSize: 12, color: 'rgba(255,255,255,.85)', marginTop: 1 },
  actions:    { padding: '6px 0 8px', borderTop: '1px solid rgba(255,255,255,.25)' },
  action:     { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 11px', borderRadius: 8, color: '#fff', fontSize: 13, cursor: 'pointer', transition: 'background .15s ease, color .15s ease' },
  logoutButton: { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', borderRadius: 6, flexShrink: 0 },
};