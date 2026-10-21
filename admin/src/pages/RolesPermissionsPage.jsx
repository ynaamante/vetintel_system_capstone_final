import { useEffect, useState } from 'react';
import Topbar from '../components/Topbar';
import StatusIndicator from '../components/StatusIndicator';
import { Icons } from '../icons';
import { formatDateText } from '../utils/dateFormatting';

const PERMISSION_GROUPS = [
  ['User Management', ['View Users', 'Create Users', 'Edit Users', 'Deactivate Users', 'Assign Roles']],
  ['Role Management', ['View Roles', 'Create Roles', 'Edit Roles', 'Assign Permissions']],
  ['Appointments', ['View Appointments', 'Create Appointment', 'Approve Appointment', 'Reschedule Appointment', 'Cancel Appointment', 'Complete Appointment', 'Manage Walk-ins', 'Manage Follow-ups', 'Manage No-shows']],
  ['Client Management', ['View Clients', 'Create Client', 'Edit Client', 'View Client History']],
  ['Patient / Pet Records', ['View Pet Records', 'Create Pet Records', 'Edit Pet Records', 'View Medical History']],
  ['Medical Workflow', ['Create Consultation', 'Edit Consultation', 'Create Prescription', 'Manage Vaccination Records', 'View Laboratory Results']],
  ['Inventory', ['View Inventory', 'Add Inventory', 'Edit Inventory', 'Restock Inventory', 'Archive Inventory', 'Request Restock', 'View Stock Movement']],
  ['Billing & Financial', ['View Billing', 'Create Invoice', 'Process Payment', 'View Financial Reports', 'View Revenue']],
  ['Services', ['View Services', 'Create Services', 'Edit Services', 'Activate / Deactivate Services']],
  ['Disease Intelligence', ['View Intelligence Dashboard', 'View Disease Monitoring', 'View Risk Monitoring', 'View Community Analytics', 'View Reports', 'View Data Sync Status']],
  ['Communication', ['View Pet Owner Messages', 'Send Pet Owner Messages', 'Manage Conversations', 'Send Notifications', 'View Notification History']],
  ['Audit', ['View Audit Trail']],
];

const emptyPermissions = () => Object.fromEntries(
  PERMISSION_GROUPS.map(([group, items]) => [group, Object.fromEntries(items.map(item => [item, false]))])
);

const permissionCount = permissions => Object.values(permissions || {}).reduce(
  (total, group) => total + Object.values(group || {}).filter(Boolean).length, 0
);

function PermissionModal({ role, onClose, onSave }) {
  const [permissions, setPermissions] = useState(() => {
    const next = emptyPermissions();
    Object.entries(role.permissions || {}).forEach(([group, values]) => {
      if (next[group]) Object.keys(next[group]).forEach(item => { next[group][item] = !!values[item]; });
    });
    return next;
  });
  const [expanded, setExpanded] = useState({});
  const toggle = (group, item) => setPermissions(prev => ({
    ...prev,
    [group]: { ...prev[group], [item]: !prev[group][item] },
  }));
  const setAll = value => setPermissions(Object.fromEntries(PERMISSION_GROUPS.map(([group, items]) => [group, Object.fromEntries(items.map(item => [item, value]))])));

  return (
    <>
      <div style={m.overlay} onClick={onClose} />
      <div style={m.panel}>
        <div style={m.header}>
          <div><div style={m.kicker}>{role.name}</div><strong>Permission Configuration - {role.name}</strong></div>
          <button type="button" aria-label="Close permission configuration" style={m.close} onClick={onClose}>{Icons.close}</button>
        </div>
        <div style={m.info}>Default permissions are provided as a starting configuration. You can customize permissions according to your clinic workflow.</div>
        <div style={m.toolbar}><div><strong>Assign Permissions</strong><small>{permissionCount(permissions)} of {PERMISSION_GROUPS.reduce((n, [, items]) => n + items.length, 0)} permissions enabled</small></div><span><button style={m.lightButton} onClick={() => setAll(true)}>Select All</button><button style={m.lightButton} onClick={() => setAll(false)}>Clear All</button></span></div>
        <div style={m.scroll}>
          {PERMISSION_GROUPS.map(([group, items]) => {
            const enabled = items.filter(item => permissions[group][item]).length;
            const open = expanded[group] !== false;
            return <div key={group} style={m.group}>
              <button style={m.groupHeader} onClick={() => setExpanded(prev => ({ ...prev, [group]: !open }))}><span><input type="checkbox" checked={enabled === items.length} onChange={() => setAll(true)} onClick={e => e.stopPropagation()} /> {group}</span><span>{enabled}/{items.length} &nbsp;⌄</span></button>
              {open && <div style={m.items}>{items.map(item => <label key={item} style={{ ...m.item, color: permissions[group][item] ? '#111827' : '#8aa0c0' }}><input type="checkbox" checked={permissions[group][item]} onChange={() => toggle(group, item)} />{item}</label>)}</div>}
            </div>;
          })}
        </div>
        <div style={m.footer}><button style={m.cancel} onClick={onClose}>Cancel</button><button style={m.save} onClick={() => onSave(permissions)}>Save Permissions</button></div>
      </div>
    </>
  );
}

function RoleViewModal({ role, onClose, staffCount }) {
  const [expanded, setExpanded] = useState({});
  const groups = PERMISSION_GROUPS.map(([group, items]) => [
    group,
    items.map(item => [item, !!role.permissions?.[group]?.[item]]),
  ]);
  const roleName = role.displayName || role.name;

  return (
    <>
      <div style={m.overlay} onClick={onClose} />
      <div style={m.viewPanel}>
        <div style={m.viewHeader}>
          <strong>{roleName} — Permission Summary</strong>
          <button type="button" style={m.close} onClick={onClose} aria-label="Close permission summary">{Icons.close}</button>
        </div>
        <div style={m.viewBody}>
          <div style={m.viewSummary}>
            <div style={m.viewSummaryCard}><small style={m.viewSummaryLabel}>Permissions</small><strong>{permissionCount(role.permissions)}</strong></div>
            <div style={m.viewSummaryCard}><small style={m.viewSummaryLabel}>Staff Assigned</small><strong>{staffCount}</strong></div>
            <div style={m.viewSummaryCard}><small style={m.viewSummaryLabel}>Status</small><StatusIndicator status="Active" /></div>
          </div>
          {groups.map(([group, items]) => {
            const enabled = items.filter(([, allowed]) => allowed).length;
            const open = expanded[group] === true;
            return (
              <div key={group} style={m.viewGroup}>
                <button type="button" style={m.viewGroupHeader} onClick={() => setExpanded(prev => ({ ...prev, [group]: !open }))} aria-expanded={open}>
                  <span>{group}</span>
                  <span style={m.viewCount}>{enabled}/{items.length}</span>
                  <span style={{ ...m.viewChevron, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>⌄</span>
                </button>
                {open && <div style={m.viewItems}>{items.map(([item, allowed]) => (
                  <div key={item} style={{ ...m.viewItem, color: allowed ? '#111827' : '#8aa0c0' }}>
                    <span style={{ color: allowed ? '#16a34a' : '#ef4444', fontWeight: 700 }}>{allowed ? '✓' : '×'}</span>
                    <span>{item}</span>
                  </div>
                ))}</div>}
              </div>
            );
          })}
        </div>
        <div style={m.viewFooter}>
          <button type="button" style={m.viewCancel} onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  );
}

function RequestRoleModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ name: '', staffNeeded: '1', reason: '' });
  const update = event => setForm(prev => ({ ...prev, [event.target.name]: event.target.value }));
  const submit = event => {
    event.preventDefault();
    onSubmit(form);
  };
  const compact = {
    requestInfo: { gap: 8, padding: '10px 12px', marginBottom: 14, borderRadius: 9, fontSize: '.72rem', lineHeight: 1.35 },
    field: { gap: 6, marginBottom: 12, fontSize: '.76rem' },
    fieldInput: { borderRadius: 8, padding: '9px 11px', fontSize: '.74rem' },
    textarea: { minHeight: 62, borderRadius: 8, padding: '9px 11px', fontSize: '.74rem' },
    requestFooter: { gap: 9, marginTop: 14 },
    cancel: { borderRadius: 7, padding: '6px 12px', fontSize: '.68rem', minWidth: 70 },
    save: { borderRadius: 7, padding: '6px 10px', fontSize: '.68rem', gap: 0, minWidth: 104, boxShadow: 'none' },
  };

  return (
    <>
      <div style={m.overlay} onClick={onClose} />
      <form style={m.requestPanel} onSubmit={submit}>
        <div style={m.requestHeader}>
          <div style={m.requestTitle}><span style={m.requestIcon}>{Icons.arrowRight}</span><strong>Request New Role</strong></div>
          <button type="button" aria-label="Close role request" style={m.close} onClick={onClose}>{Icons.close}</button>
        </div>
        <div style={{ ...m.requestInfo, ...compact.requestInfo }}><span>{Icons.lock}</span><span>Role types must be approved by <b>VetIntel Super Admin</b> before they can be used. Submit a request and wait for approval.</span></div>
        <label style={{ ...m.field, ...compact.field }}><span>Role Name <b style={m.required}>*</b></span><input style={{ ...m.fieldInput, ...compact.fieldInput }} autoFocus required name="name" value={form.name} onChange={update} placeholder="e.g. Inventory Staff, Clinic Manager" /></label>
        <label style={{ ...m.field, ...compact.field }}>Number of Staff Needed<input style={{ ...m.fieldInput, ...compact.fieldInput }} required min="1" type="number" name="staffNeeded" value={form.staffNeeded} onChange={update} /></label>
        <label style={{ ...m.field, ...compact.field }}><span>Reason for Request <b style={m.required}>*</b></span><textarea style={{ ...m.textarea, ...compact.textarea }} required name="reason" value={form.reason} onChange={update} placeholder="Explain why your clinic needs this role and how it will be used..." /></label>
        <div style={{ ...m.requestFooter, ...compact.requestFooter }}><button type="button" style={{ ...m.cancel, ...compact.cancel }} onClick={onClose}>Cancel</button><button type="submit" style={{ ...m.save, ...compact.save }}>Submit Request</button></div>
      </form>
    </>
  );
}

export default function RolesPermissionsPage({ user }) {
  const [roles, setRoles] = useState([]);
  const [roleRequests, setRoleRequests] = useState([]);
  const [staff, setStaff] = useState([]);
  const [selected, setSelected] = useState(null);
  const [viewed, setViewed] = useState(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [notification, setNotification] = useState('');
  const apiUrl = import.meta.env.VITE_API_URL || '';
  useEffect(() => {
    const headers = user.token ? { Authorization: `Bearer ${user.token}` } : {};
    Promise.all([
      fetch(`${apiUrl}/roles`, { headers }).then(response => response.ok ? response.json() : Promise.reject(new Error('Failed to load roles'))),
      fetch(`${apiUrl}/my-role-requests`, { headers }).then(response => response.ok ? response.json() : Promise.reject(new Error('Failed to load role requests'))),
      fetch(`${apiUrl}/users`, { headers }).then(response => response.ok ? response.json() : Promise.reject(new Error('Failed to load staff'))),
    ]).then(([roleRows, requestRows, staffRows]) => {
      setRoles(roleRows);
      setRoleRequests(requestRows);
      setStaff(staffRows.filter(member => {
        const role = String(member.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
        return role !== 'owner' && role !== 'clinic_owner';
      }));
    }).catch(error => {
      console.error('Failed to load roles and role requests', error);
      setNotification('Unable to load current roles and requests.');
    });
  }, [apiUrl, user.token]);
  const approvedRoleNames = new Set(
    roleRequests
      .filter(request => String(request.status).toLowerCase() === 'approved')
      .map(request => String(request.requested_role).trim().toLowerCase().replace(/[\s-]+/g, '_')),
  );
  const visibleRoles = roles
    .filter(role => approvedRoleNames.has(String(role.name).trim().toLowerCase().replace(/[\s-]+/g, '_')))
    .map(role => ({
      ...role,
      displayName: String(role.name).toLowerCase() === 'doctor' ? 'Doctor' : role.name,
    }));
  const approvedRoleCount = visibleRoles.length;
  const activeRoleCount = visibleRoles.length;
  const pendingRequestCount = roleRequests.filter(request => String(request.status).toLowerCase() === 'pending').length;
  const staffByRole = staff.reduce((counts, member) => {
    const role = String(member.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    counts[role] = (counts[role] || 0) + 1;
    return counts;
  }, {});
  const save = permissions => {
    setRoles(prev => prev.map(role => role.id === selected.id ? { ...role, permissions } : role));
    if (selected.id && typeof selected.id === 'number') {
      fetch(`${apiUrl}/roles/${selected.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` }, body: JSON.stringify({ permissions }) })
        .then(response => response.ok ? response.json() : Promise.reject(new Error('Failed to save permissions')))
        .catch(error => console.error('Failed to save role permissions', error));
    }
    setSelected(null);
    setNotification(`Permissions for "${selected.displayName || selected.name}" saved successfully.`);
    window.setTimeout(() => setNotification(''), 3000);
  };
  const submitRoleRequest = async form => {
    try {
      const response = await fetch(`${apiUrl}/my-role-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ requested_role: form.name, requested_users: form.staffNeeded, reason: form.reason }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to submit role request');
      const request = await response.json();
      setRoleRequests(prev => [request, ...prev]);
      setRequestOpen(false);
      setNotification('Role request submitted for Super Admin review.');
    } catch (error) {
      console.error('Failed to submit role request', error);
      setNotification(error.message);
    }
  };
  return <div style={s.main}>
    <Topbar user={user} title="Roles & Permissions" subtitle="Manage approved role types and configure permissions for your clinic" />
    {notification && <div style={s.notification}><span style={s.notificationIcon}>✓</span><strong>{notification}</strong></div>}
    <div style={s.page}>
      <div style={s.noticeGrid}>
        <div style={s.notice}><span style={s.noticeIcon}>{Icons.lock}</span><div style={s.noticeContent}><strong>Role Availability</strong><span>Role types are approved and provisioned by <b>VetIntel Super Admin</b>. Your clinic can only use roles that have been granted by the platform administrator.</span></div></div>
        <div style={s.noticeBlue}><span style={{ ...s.noticeIcon, color: '#005447' }}>{Icons.settings}</span><div style={s.noticeContent}><strong>Permission Configuration</strong><span>Clinic Owners <b>can customize permissions</b> for approved roles according to their clinic's workflow. Configurations are clinic-specific.</span></div></div>
      </div>
      <div style={s.stats}>{[[Icons.shield, '#e7f5f2', '#005447', approvedRoleCount, 'Approved Roles'], [Icons.check, '#f0fdf4', '#16a34a', activeRoleCount, 'Active Roles'], [Icons.users, '#faf5ff', '#9333ea', staff.length, 'Total Staff'], [Icons.clock, '#fffbeb', '#d97706', pendingRequestCount, 'Pending Requests']].map(([icon, bg, color, value, label]) => <div style={s.stat} key={label}><span style={{ ...s.statIcon, background: bg, color }}>{icon}</span><div style={s.statText}><strong>{value}</strong><span>{label}</span></div></div>)}</div>
      <section style={s.card}><div style={s.cardHeader}><div style={s.cardHeading}><strong>Approved Role Types</strong><small>Role types provisioned for your clinic</small></div><button type="button" style={s.darkButton} onClick={() => setRequestOpen(true)}>+ &nbsp; Request New Role</button></div><table style={s.table}><colgroup><col style={{ width: '21%' }} /><col style={{ width: '25%' }} /><col style={{ width: '8%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} /><col style={{ width: '12%' }} /><col style={{ width: '14%' }} /></colgroup><thead><tr>{['Role Name', 'Description', 'Staff', 'Permissions', 'Status', 'Provisioned', 'Actions'].map(label => <th style={s.th} key={label}>{label}</th>)}</tr></thead><tbody>{visibleRoles.map(role => <tr key={role.id}><td style={s.td}><strong>{role.displayName}</strong></td><td style={s.td}>{role.description || 'Approved clinic role and permissions'}</td><td style={s.td}>{staffByRole[String(role.name).trim().toLowerCase().replace(/[\s-]+/g, '_')] || 0}</td><td style={s.td}><span style={s.count}>{permissionCount(role.permissions)}</span></td><td style={s.td}><StatusIndicator status="Active" /></td><td style={s.td}>—</td><td style={s.td}><div style={s.actions}><button type="button" style={s.view} onClick={() => setViewed(role)}>View</button><button type="button" style={s.darkSmall} onClick={() => setSelected(role)}>Customize {Icons.settings}</button></div></td></tr>)}</tbody></table>{visibleRoles.length === 0 && <div style={{ textAlign: 'center', padding: '32px 20px', color: '#64748b', fontSize: '.8rem' }}>No approved roles have been provisioned for this clinic yet.</div>}</section>
      <section style={s.card}><div style={s.cardHeader}><div style={s.cardHeading}><strong>Role Requests</strong><small>Requests submitted to VetIntel Super Admin for new role types</small></div></div><table style={s.requestTable}><colgroup><col style={{ width: '15%' }} /><col style={{ width: '29%' }} /><col style={{ width: '12%' }} /><col style={{ width: '15%' }} /><col style={{ width: '10%' }} /><col style={{ width: '19%' }} /></colgroup><thead><tr>{['Requested Role', 'Reason', 'Staff Needed', 'Date Requested', 'Status', 'Admin Note'].map(label => <th style={s.th} key={label}>{label}</th>)}</tr></thead><tbody>{roleRequests.map(request => <tr key={request.id}><td style={s.td}><strong>{request.requested_role}</strong></td><td style={s.td}>{request.reason || '—'}</td><td style={s.td}>{request.requested_users || 1}</td><td style={s.td}>{request.created_at ? formatDateText(request.created_at) : '—'}</td><td style={s.td}><StatusIndicator status={request.status} /></td><td style={s.td}><em style={s.adminNote}>{String(request.status).toLowerCase() === 'approved' ? 'Approved by Super Admin' : 'Awaiting Super Admin review'}</em></td></tr>)}</tbody></table></section>
    </div>
    {viewed && <RoleViewModal role={viewed} staffCount={staffByRole[String(viewed.name).trim().toLowerCase().replace(/[\s-]+/g, '_')] || 0} onClose={() => setViewed(null)} />}
    {selected && <PermissionModal role={selected} onClose={() => setSelected(null)} onSave={save} />}
    {requestOpen && <RequestRoleModal onClose={() => setRequestOpen(false)} onSubmit={submitRoleRequest} />}
  </div>;
}

const s = {
  main: { flex: 1, minWidth: 0, overflowY: 'auto', background: '#f8fafc' },
  page: { padding: '30px 24px', width: '100%', maxWidth: 'none', margin: '0 auto' },
  noticeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 },
  notice: { background: '#fff', border: '1px solid #dbe4ee', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 10, color: '#374151', fontSize: '.7rem' },
  noticeBlue: { background: '#e7f5f2', border: '1px solid #b7e4d7', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 10, color: '#005447', fontSize: '.7rem' },
  noticeIcon: { width: 16, height: 16, display: 'flex', flexShrink: 0 },
  noticeContent: { display: 'flex', flexDirection: 'column', gap: 4, lineHeight: 1.3 },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 },
  stat: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 10 },
  statIcon: { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statText: { display: 'flex', flexDirection: 'column', gap: 2, fontSize: '.72rem' },
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 18 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '17px 20px' },
  cardHeading: { display: 'flex', flexDirection: 'column', gap: 3, fontSize: '.8rem' },
  table: { width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '.74rem' },
  requestTable: { width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '.74rem' },
  th: { textAlign: 'left', color: '#64748b', background: '#f8fafc', padding: '10px 20px', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', fontWeight: 600, fontSize: '.7rem' },
  td: { padding: '12px 20px', borderBottom: '1px solid #f1f5f9', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  count: { color: '#005447', background: '#e7f5f2', border: '1px solid #b7e4d7', borderRadius: 7, padding: '2px 7px' },
  active: { color: '#16a34a', background: '#dcfce7', borderRadius: 8, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 3 },
  provisioned: { display: 'inline-block', marginLeft: 7, color: '#374151', background: '#f1f5f9', borderRadius: 4, padding: '2px 5px', fontSize: '.58rem' },
  darkButton: { background: '#0f0b22', color: '#fff', borderRadius: 7, padding: '8px 12px', fontSize: '.72rem', fontWeight: 600, whiteSpace: 'nowrap' },
  actions: { display: 'flex', alignItems: 'center' },
  darkSmall: { background: '#0f0b22', color: '#fff', borderRadius: 6, padding: '6px 9px', marginLeft: 5, fontSize: '.68rem', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 },
  view: { background: '#fff', border: '1px solid #dbe4ee', borderRadius: 6, padding: '6px 9px', fontSize: '.68rem' },
  pending: { color: '#92400e', background: '#fef3c7', borderRadius: 8, padding: '2px 7px', width: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: 3 },
  adminNote: { color: '#4b5563' },
  notification: { position: 'fixed', top: 22, right: 24, zIndex: 200, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#111827', fontSize: '.76rem', boxShadow: '0 8px 24px rgba(15, 23, 42, .14)' },
  notificationIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 17, height: 17, borderRadius: '50%', background: '#111827', color: '#fff', fontSize: '.65rem' },
};
const m = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, padding: '14px 18px 10px', flexShrink: 0 },
  viewPanel: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(490px, calc(100% - 32px))', maxHeight: '88vh', background: '#fff', border: '1px solid #dfe6ee', borderRadius: 11, zIndex: 101, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(15, 23, 42, 0.2)' },
  viewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 12px', color: '#111827', fontSize: '.92rem', flexShrink: 0 },
  viewBody: { overflowY: 'auto', padding: '0 20px 8px' },
  viewSummary: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 },
  viewSummaryCard: { minHeight: 62, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, padding: '9px 11px', background: '#f8fafc', borderRadius: 8, color: '#0f2747', fontSize: '.78rem' },
  viewGroup: { border: '1px solid #dbe4ee', borderRadius: 8, overflow: 'hidden', marginBottom: 6 },
  viewGroupHeader: { width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: '#f8fafc', border: 0, color: '#0f2747', fontSize: '.78rem', fontWeight: 600, textAlign: 'left', cursor: 'pointer' },
  viewCount: { marginLeft: 'auto', color: '#005447', background: '#d8f4e8', borderRadius: 10, padding: '3px 8px', fontSize: '.7rem', fontWeight: 500 },
  viewChevron: { color: '#94a3b8', fontSize: '.85rem', lineHeight: 1, transition: 'transform .15s ease' },
  viewItems: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 14px', padding: '9px 12px 10px', background: '#fff' },
  viewItem: { display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: '.76rem', lineHeight: 1.3 },
  viewFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 20px 14px', borderTop: '1px solid #f1f5f9', flexShrink: 0 },
  viewCancel: { padding: '8px 14px', background: '#fff', color: '#0f1117', border: '1px solid #dfe4ea', borderRadius: 7, fontSize: '.76rem', fontWeight: 500, cursor: 'pointer' },
  viewSave: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: '#0f0b22', color: '#fff', border: 0, borderRadius: 7, fontSize: '.76rem', fontWeight: 600, cursor: 'pointer', lineHeight: 1.2 },
  viewSaveIcon: { width: 16, height: 16, display: 'flex', flexShrink: 0 },
  requestInfo: { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', marginBottom: 14, background: '#fff7ed', border: '1px solid #f5c48d', borderRadius: 9, color: '#8a4b00', fontSize: '.72rem', lineHeight: 1.35 },
  field: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, color: '#111827', fontSize: '.76rem', fontWeight: 600 },
  fieldInput: { width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '9px 11px', background: '#f3f4f6', color: '#111827', fontSize: '.74rem', boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)' },
  textarea: { width: '100%', minHeight: 62, resize: 'vertical', border: '1px solid #cbd5e1', borderRadius: 8, padding: '9px 11px', background: '#f3f4f6', color: '#111827', fontSize: '.74rem', fontFamily: 'inherit', boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)' },
  requestFooter: { display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 14 },
  cancel: { border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 15px', background: '#fff', color: '#111827', fontWeight: 600, fontSize: '.74rem', minWidth: 82 },
  save: { background: '#171b2a', color: '#fff', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: '.76rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minWidth: 142, boxShadow: '0 6px 14px rgba(23, 27, 42, 0.16)' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 100 }, panel: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(520px, calc(100% - 32px))', maxHeight: '90vh', background: '#fff', borderRadius: 12, zIndex: 101, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.2)' },   requestPanel: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(540px, calc(100% - 32px))', background: '#fff', border: '1px solid #dfe6ee', borderRadius: 14, zIndex: 101, padding: '18px 20px', boxShadow: '0 20px 50px rgba(15, 23, 42, 0.18)' }, requestHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, requestTitle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '.95rem', fontWeight: 700, color: '#111827' }, requestIcon: { color: '#005447', width: 18, height: 18, display: 'flex', transform: 'rotate(-45deg)' }, kicker: { color: '#005447', fontSize: '.72rem', marginBottom: 5 }, close: { padding: 4, color: '#475569', border: 'none', background: 'transparent', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },   info: { margin: '0 18px 12px', padding: '10px 12px', background: '#e7f5f2', border: '1px solid #b7e4d7', borderRadius: 8, color: '#005447', fontSize: '.72rem', lineHeight: 1.35 }, requestInfo: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 13px', marginBottom: 18, background: '#fff7ed', border: '1px solid #f5c48d', borderRadius: 10, color: '#8a4b00', fontSize: '.77rem', lineHeight: 1.4 }, field: { display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16, color: '#111827', fontSize: '.79rem', fontWeight: 600 }, required: { color: '#dc2626' }, fieldInput: { width: '100%', border: '1px solid #cbd5e1', borderRadius: 9, padding: '11px 12px', background: '#f3f4f6', color: '#111827', fontSize: '.77rem', boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)' }, textarea: { width: '100%', minHeight: 70, resize: 'vertical', border: '1px solid #cbd5e1', borderRadius: 9, padding: '11px 12px', background: '#f3f4f6', color: '#111827', fontSize: '.77rem', fontFamily: 'inherit', boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)' },   toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 18px 10px', fontSize: '.76rem' }, toolbarSmall: { display: 'block', color: '#7186a3', marginTop: 3, fontSize: '.68rem' }, lightButton: { border: '1px solid #dbe4ee', background: '#fff', borderRadius: 7, padding: '6px 10px', marginLeft: 6, fontSize: '.7rem' }, scroll: { overflowY: 'auto', padding: '0 18px 12px' },   group: { border: '1px solid #dbe4ee', borderRadius: 8, overflow: 'hidden', marginBottom: 6 }, groupHeader: { width: '100%', display: 'flex', justifyContent: 'space-between', padding: '9px 13px', background: '#f8fafc', border: 0, textAlign: 'left', color: '#111827', fontSize: '.76rem' },   items: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, padding: '9px 13px' }, item: { display: 'flex', gap: 7, fontSize: '.74rem', lineHeight: 1.2 }, footer: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 18px', borderTop: '1px solid #e2e8f0' }, requestFooter: { display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 18 }, cancel: { border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 20px', background: '#fff', color: '#111827', fontWeight: 600, fontSize: '.79rem', minWidth: 118 },   save: { background: '#171b2a', color: '#fff', borderRadius: 8, padding: '8px 12px', fontWeight: 700, fontSize: '.74rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minWidth: 132, boxShadow: '0 5px 12px rgba(23, 27, 42, 0.14)' },
};
