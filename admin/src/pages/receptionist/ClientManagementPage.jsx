import { useEffect, useMemo, useState } from 'react';
import Topbar from '../../components/Topbar';
import { Icons } from '../../icons';
import { canViewFeature } from '../../utils/permissionUtils';
import { formatDateText } from '../../utils/dateFormatting';

function formatDate(value) {
  return formatDateText(value, undefined, '');
}

export default function ClientManagementPage({ user }) {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canView = canViewFeature(user.permissions, user.role, 'Client Management');

  useEffect(() => {
    if (!user || !user.token) return;
    if (!canView) return;

    const apiUrl = import.meta.env.VITE_API_URL || '';
    const params = new URLSearchParams();
    if (user.clinic_id) params.set('clinic_id', user.clinic_id);
    const query = params.toString() ? `?${params.toString()}` : '';
    const headers = { Authorization: `Bearer ${user.token}` };

    const loadClients = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiUrl}/clinic-records/clients${query}`, { headers });
        if (!response.ok) throw new Error('Failed to load clients');
        const data = await response.json();
        setClients(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setError('Unable to load client data from the database.');
        setClients([]);
      } finally {
        setLoading(false);
      }
    };

    loadClients();
  }, [user, canView]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) => {
      return [client.name, client.email, client.phone].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [clients, search]);

  const totalPets = useMemo(() => clients.reduce((sum, client) => sum + Number(client.pets || 0), 0), [clients]);

  const newThisMonth = useMemo(() => {
    const now = new Date();
    return clients.filter((client) => {
      const created = new Date(client.created_at);
      if (Number.isNaN(created.getTime())) return false;
      return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
    }).length;
  }, [clients]);

  if (!canView) {
    return (
      <div style={s.main}>
        <Topbar user={user} title="Client Management" subtitle="View and manage pet owner information" />
        <div style={s.page}>
          <div style={s.pageHd}>
            <div>
              <div style={s.pageTitle}>Client Management</div>
              <div style={s.pageSub}>You do not have permission to view this page.</div>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e8ecf0', borderRadius: 14, padding: 28, color: '#475569' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Access denied</h2>
            <p style={{ marginTop: 12 }}>Your role (<strong>{user.role}</strong>) does not currently have permission to view Client Management.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.main}>
      <Topbar user={user} title="Client Management" subtitle="View and manage pet owner information" />
      <div style={s.page}>
        <div style={s.statsGrid}>
          {[
            { label: 'Total Clients', value: clients.length, icon: Icons.users, iconBg: '#e7f5f2', iconColor: '#005447' },
            { label: 'Total Pets', value: totalPets, icon: Icons.pet, iconBg: '#f5f3ff', iconColor: '#7c3aed' },
            { label: 'New This Month', value: newThisMonth, icon: Icons.users, iconBg: '#fffbeb', iconColor: '#d97706' },
            { label: 'Searchable', value: 'Yes', icon: Icons.search, iconBg: '#f0fdf4', iconColor: '#16a34a' },
          ].map((c) => (
            <div key={c.label} style={s.statCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ width: 17, height: 17, display: 'flex', color: c.iconColor }}>{c.icon}</span>
                </div>
                <div>
                  <div style={{ fontSize: '.7rem', color: '#64748b', fontWeight: 500 }}>{c.label}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2 }}>{c.value}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={s.card}>
          <div style={s.searchWrap}>
            <span style={s.searchIcon}>{Icons.search}</span>
            <input style={s.search} placeholder="Search by name, email, or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={s.tableTitle}>All Clients ({filteredClients.length})</div>
          {loading ? (
            <div style={{ padding: 40, color: '#64748b' }}>Loading clients…</div>
          ) : error ? (
            <div style={{ padding: 40, color: '#dc2626' }}>{error}</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>{['Client ID', 'Name', 'Email', 'Phone', 'Pets', 'Joined', 'Actions'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filteredClients.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...s.td, color: '#64748b' }}>No clients match your search.</td></tr>
                ) : (
                  filteredClients.map((client) => (
                    <tr key={client.id}>
                      <td style={{ ...s.td, fontWeight: 600 }}>{client.id}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{client.name}</td>
                      <td style={s.tdMuted}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 12, height: 12, display: 'flex', color: '#64748b' }}>{Icons.mail}</span>
                          {client.email || 'N/A'}
                        </div>
                      </td>
                      <td style={s.tdMuted}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 12, height: 12, display: 'flex', color: '#64748b' }}>{Icons.phone}</span>
                          {client.phone || 'N/A'}
                        </div>
                      </td>
                      <td style={s.td}>{client.pets || 0}</td>
                      <td style={s.tdMuted}>{formatDate(client.created_at)}</td>
                      <td style={s.td}>
                        <button style={s.viewBtn} disabled>
                          <span style={{ width: 13, height: 13, display: 'flex' }}>{Icons.eye}</span>
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  main: { flex: 1, overflowY: 'auto', background: '#f4f6f9' },
  page: { padding: '24px 28px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 },
  statCard: { background: '#fff', border: '1px solid #e8ecf0', borderRadius: 14, padding: '16px 20px' },
  card: { background: '#fff', border: '1px solid #e8ecf0', borderRadius: 14, padding: '20px 24px' },
  searchWrap: { position: 'relative', marginBottom: 20 },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#64748b', display: 'flex' },
  search: { width: '100%', padding: '10px 14px 10px 36px', border: '1px solid #e8ecf0', borderRadius: 8, fontSize: '.82rem', background: '#f4f6f9', outline: 'none' },
  tableTitle: { fontSize: '.9rem', fontWeight: 600, color: '#0f1117', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', fontSize: '.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', paddingBottom: 10, borderBottom: '1px solid #f1f5f9' },
  td: { padding: '13px 0', fontSize: '.82rem', color: '#0f1117', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle' },
  tdMuted: { padding: '13px 0', fontSize: '.82rem', color: '#64748b', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle' },
  viewBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: '#f8fafc', border: '1px solid #e8ecf0', borderRadius: 6, fontSize: '.75rem', color: '#0f1117', cursor: 'pointer' },
};