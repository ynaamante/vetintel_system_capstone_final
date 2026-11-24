import { apiFetch as fetch } from '../utils/apiFetch.js';
import { Icons } from '../icons';
import {useEffect,useState} from 'react';
import {useSurveillanceRefresh} from '../utils/useSurveillanceRefresh';
import { canViewFeature } from '../utils/permissionUtils';

// All available features organized by section
const ALL_NAV_ITEMS = [
  // Disease Intelligence
  { id: 'dashboard', label: 'Dashboard',              icon: 'grid',     section: 'Disease Intelligence', checkPermission: 'Intelligence Dashboard' },
  { id: 'disease',   label: 'Disease Monitoring',     icon: 'activity', section: 'Disease Intelligence', dot: true },
  { id: 'risk',      label: 'Risk Monitoring',        icon: 'shield',   section: 'Disease Intelligence' },
  { id: 'reports',   label: 'Reports',                icon: 'file',     section: 'Disease Intelligence' },
  // Clinic Management
  { id: 'clinics',   label: 'Clinic Overview',         icon: 'building', section: 'Clinic Management' },
  { id: 'users',     label: 'User Management',         icon: 'users',   section: 'Clinic Management', checkPermission: 'User & Role Management' },
  { id: 'roles',     label: 'Roles & Permissions',     icon: 'lock',    section: 'Clinic Management', checkPermission: 'Roles & Permissions' },
  { id: 'financial', label: 'Financial Monitoring',   icon: 'dollar',  section: 'Clinic Management' },
  { id: 'services',  label: 'Services Management',    icon: 'settings', section: 'Clinic Management', ownerOnly: true },
  { id: 'client-mgmt', label: 'Client Management', icon: 'users', section: 'Clinic Management' },
  { id: 'audit',     label: 'Audit Trail',            icon: 'list',    section: 'Clinic Management' },
  // Clinic Records
  { id: 'schedule',  label: 'My Schedule',             icon: 'calendar', section: 'Clinical Records', doctorOnly: true },
  { id: 'patient-intakes', label: 'Patient Intakes',   icon: 'clipboard', section: 'Clinical Records', doctorOnly: true },
  { id: 'clinic',    label: 'Local Clinic Records',   icon: 'building', section: 'Clinical Records', checkPermission: 'Local Clinic Records' },
  { id: 'patient-records', label: 'Patient Records',   icon: 'file', section: 'Clinical Records', doctorOnly: true },
  { id: 'reminders', label: 'Due Dates & Reminders', icon: 'bell', section: 'Clinical Records', doctorOnly: true },
  // Operations
  { id: 'patient-registration', label: 'New Patient Registration', icon: 'clipboard', section: 'Operations' },
  { id: 'appointments', label: 'Appointment Management', icon: 'calendar', section: 'Operations' },
  { id: 'patient-queue', label: 'Patient Queue', icon: 'users', section: 'Operations' },
  { id: 'billing', label: 'Billing & Payments', icon: 'dollar', section: 'Operations' },
];

const isDoctorRole = role => ['doctor', 'assistant_doctor', 'veterinarian'].includes(String(role || '').trim().toLowerCase().replace(/[-\s]+/g, '_'));

export default function Sidebar({ active, setPage, user, onLogout, collapsed = false, onNavigate }) {
  const [networkAlertCount,setNetworkAlertCount]=useState(0);
  const surveillanceRevision=useSurveillanceRefresh();
  const canMonitor=canViewFeature(user.permissions,user.role,'Disease Monitoring');
  useEffect(()=>{if(!canMonitor||!user.token)return;const controller=new AbortController();const api=(import.meta.env.VITE_API_URL||'http://localhost:3000/api').replace(/\/+$/,'');fetch(`${api}/disease-intelligence/monitoring?days=30`,{headers:{Authorization:`Bearer ${user.token}`},signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error('Unable to load alert count');return response.json();}).then(data=>setNetworkAlertCount(data.active_alerts||0)).catch(()=>{if(!controller.signal.aborted)setNetworkAlertCount(0);});return()=>controller.abort();},[user.token,user.clinic_id,canMonitor,surveillanceRevision]);
  const rawRole = String(user.role || '').trim().toLowerCase();
  const roleName = rawRole.replace(/[-\s]+/g, '_');

  const permissions = user.permissions || {};

  const canAccessPage = (item) => {
    if (roleName === 'super_admin') return true;
    if(item.doctorOnly && !isDoctorRole(user.role)) return false;
    const featureName = item.checkPermission || item.label;
    return canViewFeature(permissions, user.role, featureName);
  };

  // Filter navigation items ONLY by permissions, not by role title
  const NAV = ALL_NAV_ITEMS.filter((item) => canAccessPage(item));
  const groupedNav = NAV.reduce((groups, item) => {
    const key = item.section || '__general__';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
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

      {Object.entries(groupedNav).map(([sectionKey, sectionItems]) => (
        <div key={sectionKey}>
          {sectionKey !== '__general__' && !collapsed && (
            <div className={`sidebar-section${sectionKey === 'Clinic Management' ? ' sidebar-section-clinic-management' : ''}`} style={s.section}>{sectionKey}</div>
          )}
          {sectionItems.map(item => (
            <div key={item.id} className={item.id === 'schedule' ? 'sidebar-clinical-section' : undefined}>
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
                {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
                {item.dot && networkAlertCount>0 && <span className="sidebar-alert-count" style={collapsed ? s.collapsedAlertCount : s.alertCount}>{networkAlertCount} alerts</span>}
              </div>
            </div>
          ))}
        </div>
      ))}

      <div style={{ flex: 1 }} />

      {canViewFeature(permissions,user.role,'Shared Inbox') && (
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
  sidebar:    { width: 264, height: '100%', minHeight: 0, background: '#0b3a36', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', overscrollBehaviorY: 'contain', padding: '0 14px', color: '#edf9f5', position: 'relative', isolation: 'isolate', boxShadow: 'inset -1px 0 0 rgba(255,255,255,.06)' },
  sidebarCollapsed: { width: 66, padding: '0 6px' },
  mobileSidebar: { position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 1000, transition: 'transform .2s ease' },
  mobileSidebarOpen: { width: 264, boxShadow: '8px 0 24px rgba(6,72,56,.25)' },
  backdrop: { position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(15,23,42,.42)' },
  brand:      { padding: 0, fontFamily: "'DM Sans', sans-serif", fontSize: '1.2rem', fontWeight: 700, color: '#edf9f5', letterSpacing: '-.02em', lineHeight: 1, whiteSpace: 'nowrap' },
  brandCollapsed: { fontSize: '1rem', letterSpacing: 0 },
  brandRow:   { display: 'flex', alignItems: 'center', gap: 10, minHeight: 68, padding: '10px 8px 10px 4px' },
  brandRowCollapsed: { justifyContent: 'center', gap: 0, minHeight: 98, padding: '14px 0 20px', marginBottom: 1, borderBottom: '1px solid rgba(255,255,255,.12)' },
  brandToggle: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, padding: 0, border: 0, borderRadius: 10, background: 'transparent', cursor: 'pointer' },
  brandIcon: { width: 40, height: 40, borderRadius: 10, background: 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, flexShrink: 0 },
  brandIconCollapsed: { width: 34, height: 34, borderRadius: 9, padding: 8 },
  menuButton: { width: 26, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 7, background: 'transparent', color: '#dffaf3', cursor: 'pointer', marginLeft: 'auto' },
  clinicCard: { minHeight: 52, padding: '2px 4px 8px', marginBottom: 8, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, overflow: 'hidden' },
  clinicName: { color: '#fff', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4 },
  clinicMeta: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, color: 'rgba(255,255,255,.82)', fontSize: 12, whiteSpace: 'nowrap' },
  status:     { display: 'inline-flex', alignItems: 'center', gap: 5, color: '#dffaf3', fontSize: 12 },
  statusDot:  { width: 8, height: 8, borderRadius: '50%', background: '#53d38d', boxShadow: '0 0 0 3px rgba(83,211,141,.18)', flexShrink: 0 },
  section:    { padding: '14px 4px 8px', marginTop: 2, fontSize: 11, fontWeight: 700, color: 'rgba(220,245,239,.82)', letterSpacing: '.12em', textTransform: 'uppercase' },
  item:       { display: 'flex', alignItems: 'center', gap: 12, minHeight: 42, padding: '9px 10px', margin: '4px 0', borderRadius: 10, color: '#ebf9f5', fontSize: 15, fontWeight: 500, cursor: 'pointer', position: 'relative', whiteSpace: 'nowrap', transition: 'background .15s ease, color .15s ease, transform .15s ease', border: '1px solid transparent' },
  itemCollapsed: { justifyContent: 'center', gap: 0, minHeight: 41, padding: 6, margin: '0 0 0' },
  itemActive: { background: '#1c8a76', color: '#f0fffb', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.06)', fontWeight: 700 },
  inboxItem: { margin: '8px 0 0', color: '#ebf9f5' },
  inboxOwnerItem: { margin: '12px 0 0', color: '#ebf9f5' },
  inboxCount: { marginLeft: 'auto', minWidth: 21, height: 21, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 11, background: '#eef7f2', color: '#236b5b', fontSize: 11, fontWeight: 700 },
  icon:       { width: 18, height: 18, flexShrink: 0, display: 'flex', alignItems: 'center', opacity: 1, color: '#effaf5' },
  iconCollapsed: { width: 20, height: 20, justifyContent: 'center' },
  alertCount: { marginLeft: 'auto', padding: '2px 8px', borderRadius: 12, background: '#ecf9f5', color: '#265f52', fontSize: 11, fontWeight: 700, lineHeight: 1.5 },
  collapsedAlertCount: { position: 'absolute', zIndex: 1, top: -10, left: '50%', transform: 'translateX(-50%)', padding: '1px 4px', borderRadius: 8, background: '#ecf9f5', color: '#265f52', fontSize: 7, fontWeight: 700, lineHeight: 1.3, whiteSpace: 'nowrap' },
  collapsedAlertDot: { display: 'none' },
  collapsedInboxCount: { position: 'absolute', top: -4, right: -5, minWidth: 12, height: 12, padding: '0 2px', borderRadius: 7, background: '#ecf9f5', color: '#265f52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, lineHeight: 1 },
  userBox:    { minHeight: 56, padding: '8px 8px', margin: '10px 0 12px', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.08)' },
  avatar: { width: 38, height: 38, borderRadius: '50%', background: '#edf9f5', color: '#0b3a36', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 },
  userDetails: { minWidth: 0, flex: 1 },
  userName:   { width: 'fit-content', maxWidth: '100%', fontSize: 13, color: '#fff', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userRole:   { fontSize: 12, color: 'rgba(255,255,255,.8)', marginTop: 1, textTransform: 'lowercase' },
  actions:    { padding: '6px 0 8px', borderTop: '1px solid rgba(255,255,255,.12)' },
  action:     { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 11px', borderRadius: 8, color: '#edf9f5', fontSize: 14, cursor: 'pointer', transition: 'background .15s ease, color .15s ease' },
  logoutButton: { width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#edf9f5', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', flexShrink: 0, background: 'rgba(255,255,255,.03)' },
};
