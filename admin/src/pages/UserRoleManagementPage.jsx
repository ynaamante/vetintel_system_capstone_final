import { useEffect, useState } from 'react';
import Topbar from '../components/Topbar';
import StatusIndicator from '../components/StatusIndicator';
import { Icons } from '../icons';
import { canViewFeature } from '../utils/permissionUtils';

const ROLE_META = {
  owner: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: Icons.shield },
  doctor: { color: '#005447', bg: '#e7f5f2', border: '#b7e4d7', icon: Icons.activity },
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

const ActionIcon = ({ type }) => {
  const paths = {
    view: <><path d="M2 12s3.5-5 10-5 10 5 10 5-3.5 5-10 5S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    edit: <><path d="M13.5 6.5 17.5 10.5" /><path d="m4 20 4.2-1 10.2-10.2a2.8 2.8 0 0 0-4-4L4.2 15Z" /></>,
    user: <><circle cx="12" cy="7" r="3" /><path d="M5 20c.5-3.2 2.5-5 7-5s6.5 1.8 7 5" /></>,
    deactivate: <><circle cx="12" cy="7" r="3" /><path d="M5 20c.5-3.2 2.5-5 7-5s6.5 1.8 7 5" /><path d="m18 5 4 4m0-4-4 4" /></>,
    activate: <><circle cx="12" cy="7" r="3" /><path d="M5 20c.5-3.2 2.5-5 7-5s6.5 1.8 7 5" /><path d="M18 7h5m-2.5-2.5V9.5" /></>,
  };
  return <svg width="100%" height="100%" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[type]}</svg>;
};

/* ── ADD USER MODAL ── */
function AddUserModal({ onClose, onAdd, approvedRoles }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', role: '' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = () => {
    if (!form.firstName || !form.lastName || !form.email || !form.password || !form.role) return;
    onAdd({ ...form, name: `${form.firstName} ${form.lastName}` });
    onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 100 }} />
      <div style={m.panel}>
        <div style={m.header}>
          <div style={m.headerTitle}><span style={m.headerIcon}>{Icons.shield}</span> Add Staff Account</div>
          <button style={m.closeBtn} onClick={onClose}>
            <span style={{ width: 18, height: 18, display: 'flex', color: '#64748b' }}>{Icons.close}</span>
          </button>
        </div>
        <div style={m.divider} />
        <div style={m.body}>
          <div style={m.twoColumns}>
            <div style={m.field}><label style={m.label}>First Name <span style={m.required}>*</span></label><input style={m.input} placeholder="Juan" value={form.firstName} onChange={set('firstName')} /></div>
            <div style={m.field}><label style={m.label}>Last Name <span style={m.required}>*</span></label><input style={m.input} placeholder="Dela Cruz" value={form.lastName} onChange={set('lastName')} /></div>
          </div>
          <div style={m.field}>
            <label style={m.label}>Email Address <span style={m.required}>*</span></label>
            <input style={m.input} placeholder="staff@happypaws.com" value={form.email} onChange={set('email')} />
            <small style={m.help}>This will be used to log in to the system.</small>
          </div>
          <div style={m.field}>
            <label style={m.label}>Password <span style={m.required}>*</span></label>
            <input style={m.input} type="password" placeholder="Minimum 8 characters" value={form.password} onChange={set('password')} />
            <small style={m.help}>Staff will use this password on first login.</small>
          </div>
          <div style={m.field}>
            <label style={m.label}>Role <span style={m.required}>*</span></label>
            <select style={m.input} value={form.role} onChange={set('role')}>
              <option value="">Select approved role...</option>
              {APPROVED_STAFF_ROLES.filter(role => approvedRoles.includes(role.value)).map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
            <small style={m.help}>Only roles approved by Super Admin are shown.</small>
          </div>
          <div style={m.activeNotice}><span style={m.noticeIcon}><ActionIcon type="user" /></span><span>Account will be set to <strong>Active</strong> immediately upon creation.</span></div>
        </div>
        <div style={m.divider} />
        <div style={m.footer}>
          <button style={m.secondaryBtn} onClick={onClose}>Cancel</button>
          <button style={m.primaryBtn} onClick={handleSubmit}>Create Account</button>
        </div>
      </div>
    </>
  );
}

export default function UserRoleManagementPage({ user }) {
  const [users, setUsers] = useState([]);
  const [approvedRoles, setApprovedRoles] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRole] = useState('All Roles');
  const [statusFilter, setStatus] = useState('All Status');
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [notification, setNotification] = useState('');
  const [editForm, setEditForm] = useState({ id: '', name: '', email: '', role: 'doctor', status: 'Active' });

  const canView = canViewFeature(user.permissions, user.role, 'User & Role Management');

  useEffect(() => {
    if (!canView || !user?.token) return;
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const headers = { Authorization: `Bearer ${user.token}` };
    Promise.all([
      fetch(`${apiUrl}/users`, { headers }).then(response => response.ok ? response.json() : Promise.reject(new Error('Failed to load users'))),
      fetch(`${apiUrl}/my-role-requests`, { headers }).then(response => response.ok ? response.json() : Promise.reject(new Error('Failed to load role requests'))),
      fetch(`${apiUrl}/roles`, { headers }).then(response => response.ok ? response.json() : Promise.reject(new Error('Failed to load roles'))),
    ]).then(([userRows, requestRows, roleRows]) => {
      const staffRows = userRows.filter(row => {
        const role = String(row.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
        const isCurrentOwner = String(row.email || '').trim().toLowerCase() === String(user.email || '').trim().toLowerCase();
        return (role !== 'owner' && role !== 'clinic_owner') || !isCurrentOwner;
      });
      setUsers(staffRows.map(row => ({
        id: row.id, name: row.name, email: row.email, role: row.role || '', status: row.is_active === false ? 'Inactive' : 'Active',
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
    owners: users.filter(u => u.role === 'owner').length,
    doctors: users.filter(u => u.role === 'doctor').length,
    receptionists: users.filter(u => u.role === 'receptionist').length,
  };
  const pendingActivation = users.filter(u => u.status === 'Pending').length;

  const filtered = users.filter(u => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'All Roles' || u.role === roleFilter.toLowerCase();
    const matchStatus = statusFilter === 'All Status' || u.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const handleAdd = async ({ name, email, password, role }) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ name, email, password, role_name: role, clinic_id: user.clinic_id }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to create staff account');
      const row = await response.json();
      setUsers(prev => [{ id: row.id, name: row.name, email: row.email, role, status: 'Active', created: row.created_at?.slice(0, 10) || '—', lastLogin: '—' }, ...prev]);
    } catch (error) {
      console.error('Failed to create staff account', error);
      setNotification(error.message);
    }
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
    const apiUrl = import.meta.env.VITE_API_URL || '';
    fetch(`${apiUrl}/users/${editForm.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + localStorage.getItem('vetintel_token'),
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

  const handleDeactivate = id => {
    const selectedUser = users.find(u => u.id === id);
    if (!selectedUser) return;
    const nextStatus = selectedUser.status === 'Active' ? 'Inactive' : 'Active';
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: nextStatus } : u));
    setNotification(`${selectedUser.name} ${nextStatus === 'Active' ? 'activated' : 'deactivated'}.`);
    window.setTimeout(() => setNotification(''), 3000);
  };

  return (
    <div style={s.main}>
      <Topbar user={user} title="User Management" subtitle="Manage staff accounts and role assignments" />
      {notification && (
        <div style={s.notification}>
          <span style={s.notificationIcon}>✓</span>
          <strong>{notification}</strong>
        </div>
      )}
      <div style={s.page}>

        {/* STAT CARDS */}
        <div style={s.statsGrid}>
          {[
          { iconBg: '#e7f5f2', label: 'Total Staff', value: users.length, sub: 'Total Staff' },
          { iconBg: '#f0fdf4', label: 'Active Staff', value: counts.active, sub: 'Active Staff' },
          { iconBg: '#fffbeb', label: 'Pending Activation', value: pendingActivation, sub: 'Pending Activation' },
          { iconBg: '#faf5ff', label: 'Approved Roles', value: 3, sub: 'Approved Roles' },
          ].map((c, i) => (
            <div key={i} style={s.statCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ ...s.statIcon, background: c.iconBg }}>
                  <span style={{ width: 18, height: 18, display: 'flex' }}>{Icons.users}</span>
                </div>
                <div>
                  <div style={s.statValue}>{c.value}</div>
                  <div style={s.statLabel}>{c.sub}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FILTER BAR */}
        <div style={s.filterBar}>
          <div style={s.searchWrap}>
            <span style={s.searchIcon}>{Icons.search || '🔍'}</span>
            <input
              style={s.searchInput}
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select style={s.select} value={roleFilter} onChange={e => setRole(e.target.value)}>
            {['All Roles', 'Owner', 'Doctor', 'Assistant Doctor', 'Receptionist'].map(r => <option key={r}>{r}</option>)}
          </select>
          <select style={s.select} value={statusFilter} onChange={e => setStatus(e.target.value)}>
            {['All Status', 'Active', 'Inactive'].map(r => <option key={r}>{r}</option>)}
          </select>
          <button style={s.addBtn} onClick={() => setShowAdd(true)}>
            + &nbsp; Add Staff
          </button>
        </div>

        {/* TABLE */}
        <div style={s.card}>
          <div style={{ ...s.cardTitle, marginBottom: 16 }}>Staff Accounts ({filtered.length})</div>
          <table style={s.table}>
            <thead>
              <tr>
                {['Staff Name', 'Email', 'Role', 'Status', 'Last Login', 'Actions'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ ...s.td, fontWeight: 500, color: '#0f1117' }}>{u.name}</td>
                  <td style={{ ...s.td, color: '#64748b' }}>{u.email}</td>
                  <td style={s.td}><RoleBadge role={u.role} /></td>
                  <td style={s.td}><StatusBadge status={u.status} /></td>
                  <td style={{ ...s.td, color: '#64748b' }}>{u.lastLogin}</td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <button style={{ ...s.iconBtn, color: '#111827' }} title="View" onClick={() => setProfileUser(u)}>
                        <ActionIcon type="view" />
                      </button>
                      <button style={s.iconBtn} title="Edit" onClick={() => openEdit(u)}>
                        <ActionIcon type="edit" />
                      </button>
                      <button style={{ ...s.iconBtn, color: u.status === 'Active' ? '#ef3340' : '#16a34a' }} title={u.status === 'Active' ? 'Deactivate' : 'Activate'} onClick={() => handleDeactivate(u.id)}>
                        <ActionIcon type={u.status === 'Active' ? 'deactivate' : 'activate'} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '.84rem' }}>
              No users match your filters.
            </div>
          )}
        </div>

      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onAdd={handleAdd} approvedRoles={approvedRoles} />}
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
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 100 }} />
      <div style={m.panel}>
        <div style={m.header}>
          <div style={m.headerTitle}><span style={m.headerIcon}>{Icons.shield}</span> Edit Staff Account</div>
          <button style={m.closeBtn} onClick={onClose}>
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
    </>
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
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 100 }} />
      <div style={m.profilePanel}>
        <div style={m.profileHeader}><strong>Staff Profile — {user.name}</strong><button style={m.closeBtn} onClick={onClose} aria-label="Close staff profile">{Icons.close}</button></div>
        <div style={m.profileBody}>
          <div style={m.profileDetails}>
            <div><small style={m.profileLabel}>NAME</small><strong>{user.name}</strong><small style={m.profileLabel}>EMAIL</small><span>{user.email}</span></div>
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
    </>
  );
}

const s = {
  main: { flex: 1, overflowY: 'auto', background: '#f8fafc' },
  page: { padding: '30px 24px', width: '100%', maxWidth: 'none' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 },
  statCard: { background: '#fff', border: '1px solid #dfe4ea', borderRadius: 12, padding: '18px 20px' },
  statIcon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statLabel: { fontSize: '.72rem', color: '#64748b', marginTop: 2 },
  statValue: { fontFamily: "'DM Sans', sans-serif", fontSize: '1.55rem', fontWeight: 700, color: '#0f1117', letterSpacing: '-.03em', lineHeight: 1 },
  filterBar: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #dfe4ea', borderRadius: 12, padding: '16px 20px', marginBottom: 20 },
  searchWrap: { flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#f4f6f9', border: '1px solid #e8ecf0', borderRadius: 8, padding: '8px 12px' },
  searchIcon: { width: 15, height: 15, display: 'flex', color: '#64748b', flexShrink: 0, fontSize: 14 },
  searchInput: { border: 'none', background: 'transparent', outline: 'none', fontSize: '.82rem', color: '#0f1117', width: '100%' },
  select: { padding: '8px 12px', border: '1px solid #e8ecf0', borderRadius: 8, fontSize: '.82rem', color: '#0f1117', background: '#f4f6f9', outline: 'none', cursor: 'pointer' },
  addBtn: { padding: '9px 18px', background: '#0f1117', color: '#fff', border: 'none', borderRadius: 8, fontSize: '.82rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' },
  card: { background: '#fff', border: '1px solid #dfe4ea', borderRadius: 12, padding: '20px 0' },
  cardTitle: { fontSize: '.88rem', fontWeight: 600, color: '#0f1117' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 8px', fontSize: '.72rem', fontWeight: 600, color: '#334155', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' },
  td: { padding: '13px 8px', fontSize: '.8rem', color: '#374151', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' },
  idText: { fontFamily: 'monospace', fontSize: '.78rem', color: '#64748b' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 3, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24 },
  notification: { position: 'fixed', top: 18, right: 24, zIndex: 120, display: 'flex', alignItems: 'center', gap: 9, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', boxShadow: '0 8px 24px rgba(15,23,42,.12)', color: '#111827', fontSize: '.78rem' },
  notificationIcon: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: '#111827', color: '#fff', fontSize: '.7rem' },
};

const m = {
  panel: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 16, width: 440, maxWidth: '90vw', maxHeight: '92vh', overflowY: 'auto', zIndex: 101, boxShadow: '0 20px 60px rgba(0,0,0,.15)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 16px' },
  headerTitle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem', fontWeight: 600, color: '#0f1117' },
  headerIcon: { width: 18, height: 18, display: 'flex', color: '#005447' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' },
  divider: { height: 1, background: '#f1f5f9' },
  body: { padding: '18px 24px 8px' },
  twoColumns: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  field: { marginBottom: 14 },
  label: { display: 'block', fontSize: '.78rem', fontWeight: 600, color: '#1e293b', marginBottom: 6 },
  required: { color: '#ef4444' },
  input: { width: '100%', padding: '10px 12px', border: 0, borderRadius: 8, fontSize: '.84rem', color: '#0f1117', outline: 'none', background: '#f1f1f3', boxSizing: 'border-box' },
  help: { display: 'block', color: '#8aa0c0', fontSize: '.68rem', marginTop: 6 },
  activeNotice: { display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', border: '1px solid #86efac', background: '#f0fdf4', borderRadius: 9, padding: '11px 12px', fontSize: '.72rem' },
  noticeIcon: { width: 22, height: 22, display: 'flex', flexShrink: 0 },
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
  permissionValue: { marginLeft: 'auto', color: '#005447', background: '#d8f4e8', borderRadius: 12, padding: '3px 9px', fontSize: '.68rem', fontWeight: 500 },
  chevron: { color: '#94a3b8', fontSize: '1rem', lineHeight: 1, transition: 'transform .15s ease' },
  permissionItems: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 18px', padding: '10px 16px 12px', background: '#fff' },
  permissionItem: { display: 'flex', alignItems: 'center', gap: 7, fontSize: '.69rem', lineHeight: 1.2 },
  rolePill: { display: 'inline-block', color: '#005447', background: '#e7f5f2', border: '1px solid #b7e4d7', borderRadius: 7, padding: '3px 9px', marginBottom: 14 },
  profileFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0, padding: '10px 24px 16px', borderTop: '1px solid #f1f5f9' },
  profileSecondaryBtn: { padding: '8px 14px', background: '#fff', color: '#0f1117', border: '1px solid #dfe4ea', borderRadius: 8, fontSize: '.76rem', fontWeight: 500, cursor: 'pointer' },
  profilePrimaryBtn: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', background: '#0f0b22', color: '#fff', border: 'none', borderRadius: 8, fontSize: '.76rem', fontWeight: 600, cursor: 'pointer' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 24px 22px' },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: '#0f0b22', color: '#fff', border: 'none', borderRadius: 9, fontSize: '.84rem', fontWeight: 600, cursor: 'pointer' },
  secondaryBtn: { padding: '10px 16px', background: '#fff', color: '#0f1117', border: '1px solid #dfe4ea', borderRadius: 9, fontSize: '.84rem', fontWeight: 500, cursor: 'pointer' },
};
