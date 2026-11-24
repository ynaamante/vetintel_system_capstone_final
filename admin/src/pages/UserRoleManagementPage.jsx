import { usePageState } from '../utils/usePageState.js';
import { apiFetch as fetch } from '../utils/apiFetch.js';
import { useEffect, useRef, useState } from 'react';
import Topbar from '../components/Topbar';
import RecordActionsModal from '../components/RecordActionsModal';
import StatusIndicator from '../components/StatusIndicator';
import { Icons } from '../icons';
import { canViewFeature } from '../utils/permissionUtils';
import './userRoleManagement.css';

const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');

const ROLE_META = {
  owner: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: Icons.shield },
  doctor: { color: '#013826', bg: '#e7f4ec', border: '#b7e4d7', icon: Icons.activity },
  assistant_doctor: { color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff', icon: Icons.activity },
  receptionist: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: Icons.users },
};

const ROLE_LABELS = {
  owner: 'Owner',
  doctor: 'Doctor',
  assistant_doctor: 'Assistant Doctor',
  receptionist: 'Receptionist',
};

const APPROVED_STAFF_ROLES = [
  { value: 'doctor', label: 'Doctor' },
  { value: 'assistant_doctor', label: 'Assistant Doctor' },
  { value: 'receptionist', label: 'Receptionist' },
];

const normalizeRole = role => String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const roleLabel = role => {
  const normalized = normalizeRole(role);
  return ROLE_LABELS[normalized] || normalized.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
};

const RoleBadge = ({ role }) => {
  const m = ROLE_META[role] || {};
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      background: m.bg, border: `1px solid ${m.border}`,
      fontSize: '.72rem', fontWeight: 600, color: m.color,
    }}>
      <span style={{ width: 11, height: 11, display: 'flex' }}>{m.icon}</span>
      {ROLE_LABELS[role] || role}
    </span>
  );
};

const StatusBadge = ({ status }) => <StatusIndicator status={status} />;

/* ── ADD USER MODAL ── */
function StaffPasswordField({ label, value, onChange, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="urm-add-field">
      <span>{label} <span className="urm-add-required">*</span></span>
      <span className="urm-add-password">
        <input required minLength={8} autoComplete="new-password" type={visible ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} />
        <button type="button" onClick={() => setVisible(current => !current)} aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}>{visible ? Icons.eyeOff : Icons.eye}</button>
      </span>
    </label>
  );
}

function AddUserModal({ onClose, onAdd, approvedRoles }) {
  const dialog = useRef(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', role: '', position: '', password: '', confirmPassword: '', phone: '', status: 'Active' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = key => event => setForm(current => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    const previous = document.activeElement;
    dialog.current.showModal();
    return () => previous?.focus();
  }, []);

  const handleSubmit = async event => {
    event.preventDefault();
    if (busy) return;
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    if (!firstName || !lastName) {
      setError('Enter both the first name and last name.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords must match.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await onAdd({
        name: `${firstName} ${lastName}`,
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        position: form.position.trim(),
        phone: form.phone.trim(),
        isActive: form.status === 'Active',
      });
      onClose();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialog} className="urm-add-dialog" aria-labelledby="urm-add-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
      <header>
        <div><h2 id="urm-add-title">Add Staff Account</h2><p>Create a new staff account and assign their role, access, and status.</p></div>
        <button type="button" disabled={busy} onClick={onClose}>Close</button>
      </header>
      <form onSubmit={handleSubmit}>
        <fieldset className="urm-add-fields" disabled={busy}>
          <section aria-labelledby="urm-staff-info">
            <h3 id="urm-staff-info">Staff Information</h3>
            <div className="urm-add-grid">
              <label className="urm-add-field"><span>First Name <span className="urm-add-required">*</span></span><input required autoComplete="given-name" placeholder="Enter first name" value={form.firstName} onChange={set('firstName')} /></label>
              <label className="urm-add-field"><span>Last Name <span className="urm-add-required">*</span></span><input required autoComplete="family-name" placeholder="Enter last name" value={form.lastName} onChange={set('lastName')} /></label>
              <label className="urm-add-field urm-add-wide"><span>Email Address <span className="urm-add-required">*</span></span><input required type="email" autoComplete="email" placeholder="Enter email address" value={form.email} onChange={set('email')} /></label>
            </div>
          </section>
          <section aria-labelledby="urm-staff-access">
            <h3 id="urm-staff-access">Account &amp; Access</h3>
            <div className="urm-add-grid">
              <label className="urm-add-field"><span>Role <span className="urm-add-required">*</span></span><select required value={form.role} onChange={set('role')}>
                <option value="">Select role</option>
                {APPROVED_STAFF_ROLES.filter(role => approvedRoles.includes(role.value)).map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select></label>
              <label className="urm-add-field"><span>Position / Title</span><input maxLength={120} autoComplete="organization-title" placeholder="e.g., Veterinarian, Receptionist" value={form.position} onChange={set('position')} /></label>
              <StaffPasswordField label="Password" placeholder="Minimum 8 characters" value={form.password} onChange={set('password')} />
              <StaffPasswordField label="Confirm Password" placeholder="Re-enter password" value={form.confirmPassword} onChange={set('confirmPassword')} />
            </div>
          </section>
          <section aria-labelledby="urm-staff-extra">
            <h3 id="urm-staff-extra">Additional Details <small>(Optional)</small></h3>
            <div className="urm-add-grid">
              <label className="urm-add-field"><span>Contact Number</span><input type="tel" maxLength={40} autoComplete="tel" placeholder="Enter contact number" value={form.phone} onChange={set('phone')} /></label>
              <label className="urm-add-field"><span>Employment Status</span><span className="urm-add-status" data-status={form.status}>
                <select value={form.status} onChange={set('status')}><option>Active</option><option>Inactive</option></select>
              </span></label>
            </div>
          </section>
        </fieldset>
        <div className="urm-add-notice">{Icons.user}<span>Account will be set to <strong>{form.status}</strong> immediately upon creation.</span></div>
        {error && <p role="alert" className="urm-add-error">{error}</p>}
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="submit" className="urm-add-submit" disabled={busy}>{busy ? 'Creating…' : 'Create Account'}</button>
        </footer>
      </form>
    </dialog>
  );
}

export default function UserRoleManagementPage({ user }) {
  const [users, setUsers] = usePageState(user, "pages/UserRoleManagementPage.jsx:users", []);
  const [approvedRoles, setApprovedRoles] = usePageState(user, "pages/UserRoleManagementPage.jsx:approvedRoles", []);
  const [rolePermissions, setRolePermissions] = usePageState(user, "pages/UserRoleManagementPage.jsx:rolePermissions", {});
  const [search, setSearch] = useState('');
  const [roleFilter, setRole] = useState('All Roles');
  const [statusFilter, setStatus] = useState('All Status');
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [actionUserId, setActionUserId] = useState(null);
  const actionUser = users.find(staff => staff.id === actionUserId);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notification, setNotification] = useState('');
  const [editForm, setEditForm] = useState({ id: '', name: '', email: '', role: 'doctor', status: 'Active' });

  const canView = canViewFeature(user.permissions, user.role, 'User & Role Management');

  useEffect(() => {
    if (!canView || !user?.token) return;
    const headers = { Authorization: `Bearer ${user.token}` };
    Promise.all([
      fetch(`${apiUrl}/users?include_inactive=true`, { headers }).then(response => response.ok ? response.json() : Promise.reject(new Error('Failed to load users'))),
      fetch(`${apiUrl}/my-role-requests`, { headers }).then(response => response.ok ? response.json() : Promise.reject(new Error('Failed to load role requests'))),
      fetch(`${apiUrl}/roles`, { headers }).then(response => response.ok ? response.json() : Promise.reject(new Error('Failed to load roles'))),
    ]).then(([userRows, requestRows, roleRows]) => {
      const staffRows = userRows.filter(row => {
        const role = String(row.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
        const isCurrentOwner = String(row.email || '').trim().toLowerCase() === String(user.email || '').trim().toLowerCase();
        return (role !== 'owner' && role !== 'clinic_owner') || !isCurrentOwner;
      });
      setUsers(staffRows.map(row => ({
        id: row.id, name: row.name, email: row.email, position: row.position, phone: row.phone, role: row.role || '', status: row.is_active === false ? 'Inactive' : 'Active',
        created: row.created_at?.slice(0, 10) || '—', lastLogin: '—',
      })));
      const approvedRequestedRoles = requestRows
        .filter(row => String(row.status).toLowerCase() === 'approved')
        .map(row => String(row.requested_role).trim().toLowerCase().replace(/[\s-]+/g, '_'));
      const provisionedRoleNames = new Set(roleRows.map(row => String(row.name).trim().toLowerCase().replace(/[\s-]+/g, '_')));
      setApprovedRoles([...new Set(approvedRequestedRoles.filter(role => provisionedRoleNames.has(role)))]);
      setRolePermissions(Object.fromEntries(roleRows.map(row => [
        normalizeRole(row.name),
        row.permissions && typeof row.permissions === 'object' ? row.permissions : {},
      ])));
    }).catch(error => {
      console.error('Failed to load users and approved roles', error);
      setNotification('Unable to load current staff and approved roles.');
    });
  }, [canView, user]);

  if (!canView) {
    return (
      <div style={s.main}>
        <Topbar user={user} title="User & Role Management" subtitle="Manage clinic staff and their roles" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', color: '#64748b' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Access Denied</div>
          <div style={{ fontSize: '0.95rem' }}>You don't have permission to view this feature</div>
        </div>
      </div>
    );
  }

  const counts = {
    active: users.filter(u => u.status === 'Active').length,
    owners: users.filter(u => normalizeRole(u.role) === 'owner').length,
    doctors: users.filter(u => normalizeRole(u.role) === 'doctor').length,
    assistantDoctors: users.filter(u => normalizeRole(u.role) === 'assistant_doctor').length,
    receptionists: users.filter(u => normalizeRole(u.role) === 'receptionist').length,
  };
  const pendingActivation = users.filter(u => u.status === 'Pending').length;
  const filtered = users.filter(u => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'All Roles' || String(u.role).toLowerCase().replace(/[\s-]+/g, '_') === roleFilter.toLowerCase().replace(/[\s-]+/g, '_');
    const matchStatus = statusFilter === 'All Status' || u.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const handleAdd = async ({ name, email, password, role, position, phone, isActive }) => {
    const response = await fetch(`${apiUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
      body: JSON.stringify({ name, email, password, role_name: role, clinic_id: user.clinic_id, position, phone, is_active: isActive }),
    });
    const row = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(row.error || 'Failed to create staff account.');
    setUsers(prev => [{ id: row.id, name: row.name, email: row.email, position: row.position, phone: row.phone, role, status: row.is_active === false ? 'Inactive' : 'Active', created: row.created_at?.slice(0, 10) || '—', lastLogin: '—' }, ...prev]);
  };

  const openEdit = user => {
    setEditForm({
      id: user.id,
      name: user.name,
      email: user.email,
      role: ['owner', 'clinic_owner'].includes(normalizeRole(user.role))
        ? (approvedRoles[0] || '')
        : normalizeRole(user.role),
      status: user.status,
    });
    setShowEdit(true);
  };

  const handleUpdate = () => {
    if (!editForm.name || !editForm.email) return;
    fetch(`${apiUrl}/users/${editForm.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({
        name: editForm.name,
        email: editForm.email.trim(),
        role_name: normalizeRole(editForm.role),
        is_active: editForm.status === 'Active',
      }),
    }).then(response => response.ok
      ? response.json()
      : response.json().then(body => Promise.reject(new Error(body.error || 'Failed to update staff account'))))
      .then(row => {
        setUsers(prev => prev.map(u => u.id === editForm.id ? {
          ...u,
          name: row.name,
          email: row.email,
          role: normalizeRole(row.role),
          status: row.is_active === false ? 'Inactive' : 'Active',
        } : u));
        setShowEdit(false);
        setNotification('Staff account updated.');
        window.setTimeout(() => setNotification(''), 3000);
      })
      .catch(error => {
        console.error('Failed to update staff account', error);
        setNotification(error.message);
      });
  };

  const setEditField = key => e => setEditForm(f => ({ ...f, [key]: e.target.value }));

  const runStaffAction = async action => {
    setActionBusy(true);
    setActionError('');
    try {
      const staff = actionUser;
      const response = await fetch(`${apiUrl}/users/${staff.id}`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        ...(action === 'status' && { method: 'PUT', body: JSON.stringify({ is_active: staff.status !== 'Active' }) }),
      });
      const row = await response.json().catch(() => null);
      if (!response.ok || !row) throw new Error(row?.error || 'Unable to complete the staff action.');
      const status = row.is_active === false ? 'Inactive' : 'Active';
      if (action === 'status') {
        setUsers(prev => prev.map(u => u.id === staff.id ? { ...u, status } : u));
        setNotification(`${staff.name} ${status === 'Active' ? 'activated' : 'deactivated'}.`);
        window.setTimeout(() => setNotification(''), 3000);
      } else {
        const details = { ...staff, ...row, status };
        if (action === 'edit') openEdit(details);
        else setProfileUser(details);
      }
    } catch (error) {
      setActionError(error.message);
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div style={s.main}>
      <Topbar user={user} title="User Management" subtitle="Manage staff accounts and role assignments" />
      {notification && (
        <div style={s.notification} className="urm-staff-notification">
          <span style={s.notificationIcon}>✓</span>
          <strong>{notification}</strong>
        </div>
      )}
      <div style={s.page}>

        <div className="urm-stats-grid" style={s.statsGrid}>
          {[
            { label: 'Total Staff', value: users.length, sub: 'Across this clinic' },
            { label: 'Active Staff', value: counts.active, sub: 'Currently active' },
            { label: 'Pending Activation', value: pendingActivation, sub: 'Awaiting activation' },
            { label: 'Approved Roles', value: 3, sub: 'Available for assignment' },
          ].map((c, i) => (
            <div key={i} className="urm-stat-card" style={{ ...s.statCard, ...(i > 0 ? { borderLeft: '1px solid #c5d8cb' } : {}) }}>
              <div style={s.statLabel}>{c.label}</div>
              <div style={s.statValue}>{c.value}</div>
              <div style={s.statNote}>{c.sub}</div>
            </div>
          ))}
        </div>

        <section className="urm-staff-panel">
          <header className="urm-staff-heading">
            <div><h2>Staff Accounts</h2><p>Manage clinic staff and role assignments.</p></div>
            <span className="urm-result-count">{filtered.length} staff</span>
          </header>
          <div className="urm-staff-tabs" aria-label="Filter staff by role">
            {[
              { value: 'All Roles', label: 'All Staff', count: users.length },
              { value: 'Doctor', label: 'Doctors', count: counts.doctors },
              { value: 'Assistant Doctor', label: 'Assistant Doctors', count: counts.assistantDoctors },
              { value: 'Receptionist', label: 'Receptionists', count: counts.receptionists },
            ].map(item => (
              <button key={item.value} type="button" className={`urm-staff-tab${roleFilter === item.value ? ' active' : ''}`} aria-pressed={roleFilter === item.value} onClick={() => setRole(item.value)}>
                {item.label} <span>{item.count}</span>
              </button>
            ))}
            <button className="urm-staff-add" onClick={() => setShowAdd(true)}>＋ &nbsp; Add Staff</button>
          </div>
          <div className="urm-staff-filters">
          <div style={s.searchWrap}>
            <span style={s.searchIcon}>{Icons.search || '🔍'}</span>
            <input
              style={s.searchInput}
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select style={s.select} value={statusFilter} onChange={e => setStatus(e.target.value)} aria-label="Filter by status">
            {['All Status', 'Active', 'Inactive'].map(r => <option key={r}>{r}</option>)}
          </select>
          </div>
          <div className="urm-staff-table-wrap">
          <table style={s.table}>
            <thead>
              <tr>
                {['Staff Name', 'Email', 'Role', 'Status', 'Last Login'].map((h, index) => (
                  <th key={h} scope="col" style={{ ...s.th, width: ['22%', '25%', '17%', '15%', '16%'][index] }}>{h}</th>
                ))}
                <th scope="col" aria-label="Staff actions" style={{ ...s.th, width: '5%' }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} className="urm-staff-row" style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }} onClick={() => { setActionError(''); setActionUserId(u.id); }}>
                  <td style={{ ...s.td, fontWeight: 500, color: '#0f1117' }}>{u.name}</td>
                  <td style={{ ...s.td, color: '#64748b' }}>{u.email}</td>
                  <td style={s.td}><RoleBadge role={u.role} /></td>
                  <td style={s.td}><StatusBadge status={u.status} /></td>
                  <td style={{ ...s.td, color: '#64748b' }}>{u.lastLogin}</td>
                  <td style={s.td}>
                    <button type="button" className="urm-staff-chevron" aria-label={`Open staff actions for ${u.name}`}>
                      {Icons.chevronRight}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={s.emptyCell}>No users match your filters.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </section>

      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onAdd={handleAdd} approvedRoles={approvedRoles} />}
      {actionUser && <RecordActionsModal
        title="Staff Actions"
        recordLabel="Staff account"
        recordName={actionUser.name}
        recordMeta={`${roleLabel(actionUser.role)} · ${actionUser.email}`}
        recordInitials={actionUser.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}
        status={actionUser.status}
        suspended={showEdit || Boolean(profileUser)}
        onClose={() => { if (!actionBusy) setActionUserId(null); }}
        error={actionError}
        actions={[
          { label: 'View Staff Details', description: 'Review staff profile, clinic role, and account information.', icon: Icons.user, onClick: () => runStaffAction('view'), unavailable: actionBusy },
          { label: 'Edit Staff Account', description: 'Update the staff name, email, and assigned role.', icon: Icons.edit, onClick: () => runStaffAction('edit'), unavailable: actionBusy },
          actionUser.status === 'Active'
            ? { label: 'Deactivate Account', description: 'Disable access to this clinic account.', destructive: true, onClick: () => runStaffAction('status'), unavailable: actionBusy }
            : { label: 'Activate Account', description: 'Restore access to this clinic account.', icon: Icons.refresh, onClick: () => runStaffAction('status'), unavailable: actionBusy },
        ]}
      />}
      {profileUser && <StaffProfileModal user={profileUser} rolePermissions={rolePermissions[normalizeRole(profileUser.role)] || {}} onClose={() => setProfileUser(null)} />}
      {showEdit && (
        <EditUserModal
          user={editForm}
          approvedRoles={approvedRoles}
          onClose={() => setShowEdit(false)}
          onSave={handleUpdate}
          onChange={setEditField}
        />
      )}
    </div>
  );
}

function EditUserModal({ user, approvedRoles, onClose, onSave, onChange }) {
  const [firstName, ...lastParts] = user.name.split(' ');
  const lastName = lastParts.join(' ');
  return (
    <div className="urm-staff-secondary-modal">
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 100 }} />
      <div style={m.panel} role="dialog" aria-modal="true" aria-label="Edit Staff Account" onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) onClose(); }}>
        <div style={m.header}>
          <div style={m.headerTitle}><span style={m.headerIcon}>{Icons.shield}</span> Edit Staff Account</div>
          <button style={m.closeBtn} onClick={onClose} aria-label="Close staff editor" autoFocus>
            <span style={{ width: 18, height: 18, display: 'flex', color: '#64748b' }}>{Icons.close}</span>
          </button>
        </div>
        <div style={m.divider} />
        <div style={m.body}>
          <div style={m.twoColumns}>
            <div style={m.field}><label style={m.label}>First Name <span style={m.required}>*</span></label><input style={m.input} value={firstName} onChange={e => onChange('name')({ target: { value: `${e.target.value} ${lastName}` } })} /></div>
            <div style={m.field}><label style={m.label}>Last Name <span style={m.required}>*</span></label><input style={m.input} value={lastName} onChange={e => onChange('name')({ target: { value: `${firstName} ${e.target.value}` } })} /></div>
          </div>
          <div style={m.field}>
            <label style={m.label}>Email Address <span style={m.required}>*</span></label>
            <input style={m.input} placeholder="email@happypaws.com" value={user.email} onChange={onChange('email')} />
            <small style={m.help}>This will be used to log in to the system.</small>
          </div>
          <div style={m.field}>
            <label style={m.label}>Role <span style={m.required}>*</span></label>
            <select style={m.input} value={user.role} onChange={onChange('role')}>
              {APPROVED_STAFF_ROLES.filter(role => approvedRoles.includes(role.value) || role.value === user.role).map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
            <small style={m.help}>Only roles approved by Super Admin are shown.</small>
          </div>
          <div style={m.field}>
            <label style={m.label}>Account Status</label>
            <select style={m.input} value={user.status} onChange={onChange('status')}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div style={m.divider} />
        <div style={m.footer}>
          <button style={m.secondaryBtn} onClick={onClose}>Cancel</button>
          <button style={m.primaryBtn} onClick={onSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

function StaffProfileModal({ user, rolePermissions, onClose }) {
  const [expanded, setExpanded] = useState({});
  const roleName = roleLabel(user.role);
  const permissions = Object.entries(rolePermissions || {}).filter(([, values]) => values && typeof values === 'object').map(([group, values]) => [
    group,
    Object.entries(values).map(([label, allowed]) => [label, !!allowed]),
  ]);
  const permissionTotal = permissions.reduce((total, [, items]) => total + items.filter(([, allowed]) => allowed).length, 0);
  return (
    <div className="urm-staff-secondary-modal">
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 100 }} />
      <div style={m.profilePanel} role="dialog" aria-modal="true" aria-label="Staff Profile" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
        <div style={m.profileHeader}><strong>Staff Profile — {user.name}</strong><button style={m.closeBtn} onClick={onClose} aria-label="Close staff profile" autoFocus>{Icons.close}</button></div>
        <div style={m.profileBody}>
          <div style={m.profileDetails}>
            <div><small style={m.profileLabel}>NAME</small><strong>{user.name}</strong><small style={m.profileLabel}>EMAIL</small><span>{user.email}</span>{user.position && <><small style={m.profileLabel}>POSITION / TITLE</small><span>{user.position}</span></>}{user.phone && <><small style={m.profileLabel}>CONTACT NUMBER</small><span>{user.phone}</span></>}</div>
            <div><small style={m.profileLabel}>ASSIGNED ROLE</small><span style={m.rolePill}>{roleName}</span><small style={m.profileLabel}>ACCOUNT STATUS</small><StatusIndicator status={user.status} style={{ display: 'flex', marginBottom: 14 }} /><small style={m.profileLabel}>LAST LOGIN</small><span>{user.lastLogin === '—' ? 'Never' : user.lastLogin}</span></div>
          </div>
          <div style={m.profileDivider} />
          <div style={m.permissionTitle}><span>Role Permission Summary</span><span style={m.permissionCount}>{permissionTotal} permissions</span></div>
          <div>{permissions.map(([name, items]) => {
            const enabled = items.filter(([, allowed]) => allowed).length;
            const isExpanded = expanded[name] === true;
            return (
              <div key={name} style={m.permissionGroup}>
                <button type="button" style={m.permissionRow} onClick={() => setExpanded(prev => ({ ...prev, [name]: !isExpanded }))} aria-expanded={isExpanded}>
                  <span>{name}</span>
                  <span style={m.permissionValue}>{enabled}/{items.length}</span>
                  <span style={{ ...m.chevron, transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>⌄</span>
                </button>
                {isExpanded && <div style={m.permissionItems}>
                  {items.map(([label, allowed]) => <div key={label} style={{ ...m.permissionItem, color: allowed ? '#334155' : '#9db0c9' }}>
                    <span style={{ color: allowed ? '#16a34a' : '#ef4444', fontWeight: 700 }}>{allowed ? '✓' : '×'}</span>
                    <span>{label}</span>
                  </div>)}
                </div>}
              </div>
            );
          })}</div>
        </div>
        <div style={m.profileFooter}><button style={m.secondaryBtn} onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

const s = {
  main: { flex: 1, overflowY: 'auto', background: '#f8fafc' },
  page: { padding: '30px 24px', width: '100%', maxWidth: 'none' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 0, marginBottom: 20 },
  statCard: { minWidth: 0, padding: '0 24px' },
  statLabel: { fontSize: '.82rem', color: '#101914', fontWeight: 700, marginBottom: 5 },
  statValue: { fontFamily: "'DM Sans', sans-serif", fontSize: '2rem', fontWeight: 800, color: '#071c10', letterSpacing: '-.04em', lineHeight: 1.15 },
  statNote: { fontSize: '.82rem', color: '#32483d', marginTop: 7 },
  filterBar: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #dfe4ea', borderRadius: 12, padding: '16px 20px', marginBottom: 20 },
  searchWrap: { flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#f1f6ef', border: '1px solid #e8ecf0', borderRadius: 8, padding: '8px 12px' },
  searchIcon: { width: 15, height: 15, display: 'flex', color: '#64748b', flexShrink: 0, fontSize: 14 },
  searchInput: { border: 'none', background: 'transparent', outline: 'none', fontSize: '.82rem', color: '#0f1117', width: '100%' },
  select: { padding: '8px 12px', border: '1px solid #e8ecf0', borderRadius: 8, fontSize: '.82rem', color: '#0f1117', background: '#f1f6ef', outline: 'none', cursor: 'pointer' },
  addBtn: { padding: '9px 18px', background: '#0f1117', color: '#fff', border: 'none', borderRadius: 8, fontSize: '.82rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' },
  card: { background: '#fff', border: '1px solid #dfe4ea', borderRadius: 12, padding: '0 0 8px', overflow: 'hidden' },
  cardTitle: { fontSize: '.88rem', fontWeight: 600, color: '#0f1117' },
  table: { width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' },
  th: { textAlign: 'left', height: 40, padding: '0 11px', fontSize: '.75rem', fontWeight: 650, color: '#171d21', background: '#f6fafb', borderBottom: '1px solid #e6eff2', whiteSpace: 'nowrap' },
  td: { padding: '13px 11px', fontSize: '.8rem', color: '#374151', borderBottom: '1px solid #e9f0f2', verticalAlign: 'middle', overflowWrap: 'anywhere' },
  emptyCell: { height: 68, padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '.84rem', borderBottom: '0' },
  idText: { fontFamily: 'monospace', fontSize: '.78rem', color: '#64748b' },
  notification: { position: 'fixed', top: 18, right: 24, zIndex: 120, display: 'flex', alignItems: 'center', gap: 9, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', boxShadow: '0 8px 24px rgba(15,23,42,.12)', color: '#111827', fontSize: '.78rem' },
  notificationIcon: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: '#111827', color: '#fff', fontSize: '.7rem' },
};

const m = {
  panel: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 16, width: 440, maxWidth: '90vw', maxHeight: '92vh', overflowY: 'auto', zIndex: 101, boxShadow: '0 20px 60px rgba(0,0,0,.15)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 16px' },
  headerTitle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem', fontWeight: 600, color: '#0f1117' },
  headerIcon: { width: 18, height: 18, display: 'flex', color: '#013826' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' },
  divider: { height: 1, background: '#f1f5f9' },
  body: { padding: '18px 24px 8px' },
  twoColumns: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  field: { marginBottom: 14 },
  label: { display: 'block', fontSize: '.78rem', fontWeight: 600, color: '#1e293b', marginBottom: 6 },
  required: { color: '#ef4444' },
  input: { width: '100%', padding: '10px 12px', border: 0, borderRadius: 8, fontSize: '.84rem', color: '#0f1117', outline: 'none', background: '#f1f1f3', boxSizing: 'border-box' },
  help: { display: 'block', color: '#8aa0c0', fontSize: '.68rem', marginTop: 6 },
  buttonIcon: { width: 18, height: 18, display: 'flex' },
  profilePanel: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 12, width: 520, maxWidth: '92vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 101, boxShadow: '0 20px 60px rgba(0,0,0,.2)' },
  profileHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, padding: '20px 24px 14px', fontSize: '1rem', color: '#111827' },
  profileBody: { padding: '0 24px 12px', overflowY: 'auto' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 },
  summaryCard: { minHeight: 68, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, padding: '10px 12px', borderRadius: 10, background: '#f8fafc' },
  summaryLabel: { color: '#64748b', fontSize: '.66rem' },
  summaryValue: { color: '#0f2747', fontSize: '1.05rem', lineHeight: 1 },
  summaryStatus: { color: '#0f2747', fontSize: '.78rem' },
  profileDetails: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, color: '#334155', fontSize: '.78rem' },
  profileLabel: { display: 'block', color: '#8aa0c0', fontWeight: 600, fontSize: '.68rem', margin: '0 0 5px' },
  profileDivider: { height: 1, background: '#e2e8f0', margin: '2px 0 14px' },
  permissionTitle: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: '.78rem', fontWeight: 600, color: '#334155' },
  permissionCount: { border: '1px solid #e2e8f0', borderRadius: 8, padding: '3px 9px', fontWeight: 500, fontSize: '.68rem' },
  permissionGroup: { border: '1px solid #dbe4ee', borderRadius: 10, overflow: 'hidden', marginBottom: 6 },
  permissionRow: { width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: '#f8fafc', border: 0, padding: '10px 16px', fontSize: '.75rem', fontWeight: 600, color: '#0f2747', textAlign: 'left', cursor: 'pointer' },
  permissionValue: { marginLeft: 'auto', color: '#013826', background: '#d8f4e8', borderRadius: 12, padding: '3px 9px', fontSize: '.68rem', fontWeight: 500 },
  chevron: { color: '#94a3b8', fontSize: '1rem', lineHeight: 1, transition: 'transform .15s ease' },
  permissionItems: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 18px', padding: '10px 16px 12px', background: '#fff' },
  permissionItem: { display: 'flex', alignItems: 'center', gap: 7, fontSize: '.69rem', lineHeight: 1.2 },
  rolePill: { display: 'inline-block', color: '#013826', background: '#e7f4ec', border: '1px solid #b7e4d7', borderRadius: 7, padding: '3px 9px', marginBottom: 14 },
  profileFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0, padding: '10px 24px 16px', borderTop: '1px solid #f1f5f9' },
  profileSecondaryBtn: { padding: '8px 14px', background: '#fff', color: '#0f1117', border: '1px solid #dfe4ea', borderRadius: 8, fontSize: '.76rem', fontWeight: 500, cursor: 'pointer' },
  profilePrimaryBtn: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', background: '#0f0b22', color: '#fff', border: 'none', borderRadius: 8, fontSize: '.76rem', fontWeight: 600, cursor: 'pointer' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 24px 22px' },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: '#0f0b22', color: '#fff', border: 'none', borderRadius: 9, fontSize: '.84rem', fontWeight: 600, cursor: 'pointer' },
  secondaryBtn: { padding: '10px 16px', background: '#fff', color: '#0f1117', border: '1px solid #dfe4ea', borderRadius: 9, fontSize: '.84rem', fontWeight: 500, cursor: 'pointer' },
};
