# Shared layouts

## admin/src/components/Sidebar.jsx
```
import { Icons } from '../icons';
import { canViewFeature } from '../utils/permissionUtils';

// All available features organized by section
const ALL_NAV_ITEMS = [
  // Disease Intelligence
  { id: 'dashboard', label: 'Dashboard',              icon: 'grid',     section: 'Disease Intelligence', checkPermission: 'Intelligence Dashboard' },
  { id: 'disease',   label: 'Disease Monitoring',     icon: 'activity', dot: true },
  { id: 'risk',      label: 'Risk Monitoring',         icon: 'shield'   },
  { id: 'reports',   label: 'Reports',                icon: 'file'     },
  // Clinic Management
  { id: 'clinics',   label: 'Clinic Overview',         icon: 'building', section: 'Clinic Management' },
  { id: 'users',     label: 'User Management',         icon: 'users',   checkPermission: 'User & Role Management' },
  { id: 'roles',     label: 'Roles & Permissions',     icon: 'lock',    checkPermission: 'User & Role Management' },
  { id: 'financial', label: 'Financial Monitoring',   icon: 'dollar'   },
  { id: 'services',  label: 'Services Management',    icon: 'settings', ownerOnly: true },
  { id: 'client-mgmt', label: 'Client Management', icon: 'users' },
  { id: 'audit',     label: 'Audit Trail',            icon: 'list'     },
  // Clinic Records
  { id: 'schedule',  label: 'My Schedule',             icon: 'calendar', section: 'Clinical Records', doctorOnly: true },
  { id: 'patient-intakes', label: 'Patient Intakes',   icon: 'clipboard', doctorOnly: true },
  { id: 'clinic',    label: 'Local Clinic Records',   icon: 'building', checkPermission: 'Pet Profiles' },
  { id: 'patient-records', label: 'Patient Records',   icon: 'file', doctorOnly: true },
  { id: 'reminders', label: 'Due Dates & Reminders', icon: 'bell', doctorOnly: true },
  // Operations
  { id: 'patient-registration', label: 'New Patient Registration', icon: 'clipboard', section: 'Operations', receptionistOnly: true },
  { id: 'appointments', label: 'Appointment Management', icon: 'calendar', receptionistOnly: true },
  { id: 'patient-queue', label: 'Patient Queue', icon: 'users', receptionistOnly: true },
  { id: 'billing', label: 'Billing & Payments', icon: 'dollar', receptionistOnly: true },
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
      <div className={`admin-sidebar admin-sidebar-${roleName}`} style={{ ...s.sidebar, ...(collapsed ? s.sidebarCollapsed : {}), ...(isMobile ? s.mobileSidebar : {}), ...(!collapsed && isMobile ? s.mobileSidebarOpen : {}) }}>
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
        <div key={item.id} className={item.id === 'schedule' ? 'sidebar-clinical-section' : undefined}>
          {item.section && !collapsed && <div className={`sidebar-section${item.section === 'Clinic Management' ? ' sidebar-section-clinic-management' : ''}`} style={s.section}>{item.section}</div>}
          <div
            className={`sidebar-nav-item${(active === item.id || (item.id === 'services' && active === 'inventory')) ? ' active' : ''}`}
            style={{ ...s.item, ...(collapsed ? s.itemCollapsed : {}), ...((active === item.id || (item.id === 'services' && active === 'inventory')) ? s.itemActive : {}) }}
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
          className={`sidebar-nav-item sidebar-inbox-item${active === 'inbox' ? ' active' : ''}`}
          style={{ ...s.item, ...(collapsed ? s.itemCollapsed : {}), ...(roleName === 'owner' ? s.inboxOwnerItem : s.inboxItem), ...(active === 'inbox' ? s.itemActive : {}) }}
          onClick={() => navigate('inbox')}
          title={collapsed ? 'Shared Inbox' : undefined}
        >
          <span className="sidebar-icon sidebar-inbox-icon" style={{ ...s.icon, ...(collapsed ? s.iconCollapsed : {}) }}>
            {Icons.mail}
            
          </span>
          {!collapsed && <span>Shared Inbox</span>}
          
        </div>
      )}

      <div style={s.actions}>
        <button type="button" className={`sidebar-action${active === 'settings' ? ' active' : ''}`} style={{ ...s.action, width: '100%', border: 0, background: active === 'settings' ? '#0a966b' : 'transparent', textAlign: 'left', ...(collapsed ? { justifyContent: 'center', padding: '10px 0' } : {}) }} onClick={() => navigate('settings')} aria-current={active === 'settings' ? 'page' : undefined} aria-label="Settings" title={collapsed ? 'Settings' : undefined}><span style={s.icon}>{Icons.settings}</span>{!collapsed && 'Settings'}</button>
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
  itemActive: { background: '#0a966b', color: '#fff', boxShadow: 'none', fontWeight: 700 },
  inboxItem: { margin: '0 0 8px', color: '#fff' },
  inboxOwnerItem: { margin: '16px 0 8px', color: '#fff' },
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

```

## admin/src/components/Topbar.jsx
```
import { useEffect, useState } from 'react';
import { Icons } from '../icons';
import { subscribeToNotifications } from '../utils/notifications';

const INITIAL_NOTIFICATIONS = [];
const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');

export default function Topbar({ user, title, subtitle, actions, headerContent, className = '' }) {
  const notificationStorageKey = `vetintel_notifications_${user?.id || user?.clinic_id || 'user'}`;
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(notificationStorageKey) || 'null');
      return Array.isArray(saved) ? saved.filter(item => typeof item.id === 'string' && (item.id.startsWith('server-') || /^\d{13}-/.test(item.id))) : INITIAL_NOTIFICATIONS;
    } catch {
      return INITIAL_NOTIFICATIONS;
    }
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const unreadCount = notifications.filter(notification => notification.unread).length;
  const visibleNotifications = (unreadOnly
    ? notifications.filter(notification => notification.unread)
    : notifications
  ).slice(0, showAll ? notifications.length : 5);

  useEffect(() => subscribeToNotifications(notification => {
    setNotifications(current => {
      const next = [notification, ...current].slice(0, 50);
      localStorage.setItem(notificationStorageKey, JSON.stringify(next));
      return next;
    });
  }), [notificationStorageKey]);

  useEffect(() => {
    if (!user?.token || !user?.clinic_id) return undefined;
    let active = true;
    const loadNotifications = async () => {
      try {
        const response = await fetch(`${apiBase}/notifications`, { headers: { Authorization: `Bearer ${user.token}` } });
        const rows = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(rows.error || 'Unable to load notifications.');
        if (!active) return;
        const remoteNotifications = rows.map(row => ({
          id: `server-${row.id}`,
          remoteId: row.id,
          icon: 'info',
          color: '#0a966b',
          title: row.title,
          text: row.text,
          time: row.created_at ? new Date(row.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '',
          unread: !row.read_at,
        }));
        setNotifications(current => {
          const remoteIds = new Set(remoteNotifications.map(item => item.id));
          const previousById = new Map(current.filter(item => remoteIds.has(item.id)).map(item => [item.id, item]));
          const merged = remoteNotifications.map(item => previousById.has(item.id)
            ? { ...item, unread: previousById.get(item.id).unread }
            : item);
          const next = [...merged, ...current.filter(item => !remoteIds.has(item.id))].slice(0, 50);
          localStorage.setItem(notificationStorageKey, JSON.stringify(next));
          return next;
        });
        setNotificationError('');
      } catch (error) {
        if (active) setNotificationError(error.message || 'Unable to load notifications.');
      }
    };
    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 30000);
    window.addEventListener('vetintel:billing-updated', loadNotifications);
    window.addEventListener('vetintel:registration-updated', loadNotifications);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('vetintel:billing-updated', loadNotifications);
      window.removeEventListener('vetintel:registration-updated', loadNotifications);
    };
  }, [notificationStorageKey, user?.clinic_id, user?.token]);

  const markRead = id => {
    const notification = notifications.find(item => item.id === id);
    setNotifications(current => {
      const next = current.map(notification => (
      notification.id === id ? { ...notification, unread: false } : notification
      ));
      localStorage.setItem(notificationStorageKey, JSON.stringify(next));
      return next;
    });
    if (notification?.remoteId && user?.token) {
      fetch(`${apiBase}/notifications/${notification.remoteId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user.token}` },
      }).then(async response => {
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error || 'Unable to mark the notification as read.');
        }
      }).catch(error => setNotificationError(error.message || 'Unable to mark the notification as read.'));
    }
  };

  const markAllRead = () => {
    notifications.filter(notification => notification.remoteId && notification.unread).forEach(notification => {
      fetch(`${apiBase}/notifications/${notification.remoteId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user?.token}` },
      }).then(async response => {
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error || 'Unable to mark notifications as read.');
        }
      }).catch(error => setNotificationError(error.message || 'Unable to mark notifications as read.'));
    });
    setNotifications(current => {
      const next = current.map(notification => ({ ...notification, unread: false }));
      localStorage.setItem(notificationStorageKey, JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className={className} style={s.bar}>
      <div>
        {headerContent || (
          <>
            <h2 style={s.title}>{title}</h2>
            <p style={s.subtitle}>{subtitle}</p>
          </>
        )}
      </div>

      <div style={s.right}>
        {actions}
        <button type="button" style={{ ...s.notif, ...(showNotifications ? s.notifActive : {}) }} onClick={() => setShowNotifications(current => !current)} aria-label="Open notifications">
          <span style={s.notifIcon}>{Icons.bell}</span>
          {unreadCount > 0 && <span style={s.pip} />}
        </button>

        {showNotifications && (
          <div style={s.notificationPanel}>
            <div style={s.notificationHeader}>
              <div style={s.notificationHeading}>
                <span style={s.notificationBell}>{Icons.bell}</span>
                <strong>Notifications</strong>
                {unreadCount > 0 && <span style={s.newBadge}>{unreadCount} new</span>}
              </div>
              <div style={s.notificationHeaderActions}>
                <button type="button" style={{ ...s.filterButton, ...(unreadOnly ? s.filterButtonActive : {}) }} onClick={() => setUnreadOnly(current => !current)}>Unread only</button>
                <button type="button" style={s.markAllButton} onClick={markAllRead}>Mark all read</button>
                <button type="button" style={s.closeButton} onClick={() => setShowNotifications(false)} aria-label="Close notifications">{Icons.close}</button>
              </div>
            </div>
            <div style={s.notificationSummary}>Showing notifications for <strong>{user.role}</strong> · {notifications.length} total</div>
            {notificationError && <div role="alert" style={s.notificationSummary}>{notificationError}</div>}
            <div style={s.notificationList}>
              {visibleNotifications.map(notification => (
                <div key={notification.id} style={{ ...s.notificationItem, ...(notification.unread ? s.unreadItem : {}) }}>
                  <div style={{ ...s.notificationIcon, color: notification.color }}><span style={s.notificationIconSvg}>{Icons[notification.icon] || Icons.info}</span></div>
                  <div style={s.notificationContent}>
                    <div style={s.notificationTitle}>
                      <span>{notification.title}</span>
                      {notification.unread && <span style={{ ...s.unreadDot, background: notification.color }} />}
                    </div>
                    <div style={s.notificationText}>{notification.text}</div>
                    <div style={s.notificationMeta}>{notification.time}{notification.pet ? `  ·  ${notification.pet}` : ''}</div>
                  </div>
                  <button type="button" style={s.notificationArrow} onClick={() => markRead(notification.id)} aria-label={notification.unread ? 'Mark notification as read' : 'Notification read'}>
                    {notification.unread ? 'Mark read' : <span style={s.notificationArrowIcon}>{Icons.arrowRight}</span>}
                  </button>
                </div>
              ))}
              {visibleNotifications.length === 0 && <div style={s.emptyNotifications}>No unread notifications</div>}
            </div>
            <button type="button" style={s.viewAllButton} onClick={() => setShowAll(current => !current)}>
              {showAll ? 'Show fewer notifications' : 'View all notifications'}
            </button>
          </div>
        )}

        <div style={s.pill}>
          <div style={s.avatar}>{user.initials}</div>
          <div>
            <div style={s.pillName}>{user.name}</div>
            <div style={s.pillRole}>{user.role}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 28px',
    background: '#fff',
    borderBottom: '1px solid #e8ecf0',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    gap: 16,
  },
  title: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '1.25rem',
    fontWeight: 600,
    letterSpacing: '-.01em',
    color: '#004f43',
  },
  subtitle: { fontSize: '.9rem', color: '#64748b', marginTop: 1 },
  right: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 },
  notif: {
    position: 'relative',
    padding: 6,
    borderRadius: 8,
    color: '#64748b',
    display: 'flex',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
  },
  notifActive: {
    background: '#f1f5f9',
  },
  notifIcon: { width: 17, height: 17, display: 'flex' },
  pip: {
    position: 'absolute',
    top: 5, right: 5,
    width: 7, height: 7,
    background: '#dc2626',
    borderRadius: '50%',
    border: '1.5px solid #fff',
  },
  notificationPanel: {
    position: 'absolute',
    top: 'calc(100% + 1px)',
    right: 28,
    width: 390,
    maxWidth: 'calc(100vw - 32px)',
    background: '#fff',
    border: '1px solid #e8ecf0',
    borderRadius: '0 0 10px 10px',
    boxShadow: '0 14px 30px rgba(15, 23, 42, .14)',
    overflow: 'hidden',
    zIndex: 30,
  },
  notificationHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 12px 10px', borderBottom: '1px solid #e7edf4' },
  notificationHeading: { display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a', fontSize: '.86rem' },
  notificationBell: { width: 15, height: 15, display: 'flex', color: '#64748b' },
  newBadge: { padding: '4px 8px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', fontSize: '.64rem', fontWeight: 600 },
  notificationHeaderActions: { display: 'flex', alignItems: 'center', gap: 7 },
  filterButton: { border: 0, borderRadius: 12, padding: '4px 8px', background: '#fff', color: '#013826', fontSize: '.64rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  filterButtonActive: { background: '#086b50', color: '#fff' },
  markAllButton: { border: 0, background: 'transparent', color: '#013826', fontSize: '.64rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  closeButton: { width: 18, height: 18, display: 'flex', padding: 1, border: 0, background: 'transparent', color: '#94a3b8', cursor: 'pointer' },
  notificationSummary: { padding: '8px 12px', background: '#f8fafc', color: '#64748b', fontSize: '.64rem', borderBottom: '1px solid #edf2f7' },
  notificationList: { maxHeight: 462, overflowY: 'auto' },
  notificationItem: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 12px', borderBottom: '1px solid #edf2f7' },
  unreadItem: { background: '#fbfdff' },
  notificationIcon: { width: 30, height: 30, borderRadius: 9, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notificationIconSvg: { width: 15, height: 15, display: 'flex' },
  notificationContent: { flex: 1, minWidth: 0 },
  notificationTitle: { display: 'flex', alignItems: 'center', gap: 6, color: '#172033', fontSize: '.74rem', fontWeight: 600, lineHeight: 1.3 },
  unreadDot: { width: 5, height: 5, borderRadius: '50%', flexShrink: 0 },
  notificationText: { marginTop: 3, color: '#405673', fontSize: '.68rem', lineHeight: 1.35 },
  notificationMeta: { marginTop: 4, color: '#8aa0bd', fontSize: '.63rem' },
  notificationArrow: { alignSelf: 'center', minWidth: 48, border: 0, background: 'transparent', color: '#013826', fontSize: '.62rem', cursor: 'pointer', padding: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' },
  notificationArrowIcon: { width: 12, height: 12, display: 'flex', color: '#cbd5e1' },
  emptyNotifications: { padding: '30px 12px', textAlign: 'center', color: '#64748b', fontSize: '.75rem' },
  viewAllButton: { width: '100%', padding: '12px', border: 0, borderTop: '1px solid #e7edf4', background: '#fff', color: '#013826', fontSize: '.75rem', cursor: 'pointer' },
  pill: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '5px 10px 5px 5px',
    borderRadius: 30,
    border: '1px solid #e8ecf0',
  },
  avatar: {
    width: 28, height: 28,
    borderRadius: '50%',
    background: '#006b5b',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '.8rem',
    fontWeight: 600,
    letterSpacing: '.02em',
  },
  pillName: { fontSize: '.95rem', fontWeight: 500, color: '#0f1117' },
  pillRole: { fontSize: '.8rem', color: '#64748b' },
};

```
