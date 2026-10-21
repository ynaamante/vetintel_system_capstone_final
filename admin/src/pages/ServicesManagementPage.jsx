import { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import Topbar from '../components/Topbar';
import StatusIndicator from '../components/StatusIndicator';
import { Icons } from '../icons';
import { canViewFeature } from '../utils/permissionUtils';

const CATEGORY_COLORS = {
  Consultation: ['#d8f4e8', '#005447', '#139b76'],
  Treatment: ['#ccfbf1', '#0f766e', '#14b8a6'],
  Medication: ['#eff6ff', '#1d4ed8', '#3b82f6'],
  Vaccination: ['#f3e8ff', '#9333ea', '#8b5cf6'],
  Surgery: ['#fee2e2', '#dc2626', '#ef4444'],
  Dental: ['#ccfbf1', '#0f766e', '#14b8a6'],
  Grooming: ['#fce7f3', '#db2777', '#ec4899'],
  Laboratory: ['#fef3c7', '#b45309', '#f59e0b'],
  Confinement: ['#e0e7ff', '#005447', '#6366f1'],
  General: ['#f1f5f9', '#475569', '#64748b'],
  'Medical Supplies': ['#ecfeff', '#155e75', '#0891b2'],
  'Wound Care': ['#fff1f2', '#9f1239', '#e11d48'],
  'Laboratory Supplies': ['#fefce8', '#854d0e', '#ca8a04'],
  'Grooming & Hygiene': ['#fdf2f8', '#9d174d', '#db2777'],
  'Surgical Equipment': ['#eef2ff', '#3730a3', '#6366f1'],
  'Clinic Accessories': ['#f0fdf4', '#166534', '#16a34a'],
};

const CATEGORY_TO_TYPE = {
  Consultation: 'consultation',
  Treatment: 'treatment',
  Medication: 'medication',
  Vaccination: 'vaccination',
  Laboratory: 'lab_test',
  Confinement: 'inpatient',
  Surgery: 'treatment',
  Dental: 'treatment',
  Grooming: 'treatment',
  General: 'treatment',
  'Medical Supplies': 'medication',
  'Wound Care': 'medication',
  'Laboratory Supplies': 'medication',
  'Grooming & Hygiene': 'medication',
  'Surgical Equipment': 'medication',
  'Clinic Accessories': 'medication',
};
const TYPE_TO_CATEGORY = {
  consultation: 'Consultation',
  treatment: 'Treatment',
  medication: 'Medication',
  vaccination: 'Vaccination',
  lab_test: 'Laboratory',
  inpatient: 'Confinement',
};
const mapCatalogItem = item => ({
  ...item,
  category: item.category || TYPE_TO_CATEGORY[item.item_type] || 'General',
  price: Number(item.unit_price),
  month: 0,
  requiredItems: 0,
  status: item.active ? 'Available' : 'Unavailable',
  archived: !item.active,
});

function CategoryBadge({ category }) {
  const [background, color] = CATEGORY_COLORS[category] || CATEGORY_COLORS.General;
  return <span style={{ ...s.categoryBadge, background, color }}>{category}</span>;
}

function ServiceIcon({ category }) {
  const color = (CATEGORY_COLORS[category] || CATEGORY_COLORS.General)[2];
  const glyph = category === 'Laboratory'
    ? <><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3" /><path d="M8 15h8" /></>
    : category === 'Surgery' || category === 'Grooming'
      ? <><path d="M5 19 19 5" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="6" r="3" /><path d="m9 15 6-6" /></>
      : category === 'General'
        ? <><circle cx="12" cy="12" r="8" /><path d="M12 8v8M8 12h8" /></>
        : <><path d="M12 3v18M8 7h8M8 17h8" /><path d="M8 7c0 2 8 2 8 0M8 17c0-2 8-2 8 0" /></>;
  return <span style={{ ...s.serviceIcon, color }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{glyph}</svg></span>;
}

function SummaryIcon({ type }) {
  const paths = {
    tag: <><path d="M4 5h8l7 7-7 7-8-8V5Z" /><circle cx="8" cy="9" r="1" /></>,
    pulse: <path d="m3 12 4-1 2 6 4-12 2 7 6-1" />,
    dollar: <><path d="M12 3v18M16 7c-1-2-7-2-7 1 0 4 7 1 7 5 0 3-6 4-7 0" /></>,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{paths[type]}</svg>;
}

export default function ServicesManagementPage({ user }) {
  const [services, setServices] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [status, setStatus] = useState('All Statuses');
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'Consultation', price: '', duration: '', unit: 'item', description: '', status: 'Available' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [catalogSeedMessage, setCatalogSeedMessage] = useState('');

  const canView = String(user.role || '').trim().toLowerCase() === 'owner'
    || canViewFeature(user.permissions, user.role, 'Services Management');
  const chartData = useMemo(() => Object.keys(CATEGORY_COLORS).map(category => ({
    category,
    count: services.filter(service => service.category === category && !service.archived).length,
    color: CATEGORY_COLORS[category][2],
  })).filter(item => item.count > 0), [services]);
  const loadCatalog = async () => {
    setLoading(true);
    setError('');
    setCatalogSeedMessage('');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const isClinicOwner = ['owner', 'clinic_owner'].includes(String(user.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_'));
      if (isClinicOwner) {
        const seedResponse = await fetch(`${apiUrl}/clinic-records/billing-catalog/seed-defaults`, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + user.token },
        });
        const seedPayload = await seedResponse.json().catch(() => ({}));
        if (!seedResponse.ok) throw new Error(seedPayload.error || 'Unable to add the supplied clinic price list.');
        if (seedPayload.added > 0) setCatalogSeedMessage(`${seedPayload.added} supplied service and product prices were loaded. You can edit them; these defaults will not overwrite later changes.`);
      }
      const response = await fetch(`${apiUrl}/clinic-records/billing-catalog?include_inactive=true`, {
        headers: { Authorization: 'Bearer ' + user.token },
      });
      const payload = await response.json().catch(() => []);
      if (!response.ok || !Array.isArray(payload)) throw new Error(payload.error || 'Unable to load the clinic price catalog.');
      setServices(payload.map(mapCatalogItem));
    } catch (loadError) {
      setError(loadError.message || 'Unable to load the clinic price catalog.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (canView) loadCatalog();
  }, [canView, user?.token]);
  const visibleServices = useMemo(() => services.filter(service => (
    (showArchived ? service.archived : !service.archived)
    && (category === 'All Categories' || service.category === category)
    && (status === 'All Statuses' || service.status === status)
    && `${service.name} ${service.description}`.toLowerCase().includes(search.toLowerCase())
  )), [category, search, services, showArchived, status]);

  const openAdd = () => {
    setForm({ name: '', category: 'Consultation', price: '', duration: '', unit: 'item', description: '', status: 'Available' });
    setModal({ type: 'add' });
  };
  const openEdit = service => {
    setForm({ name: service.name, category: service.category, price: service.price, duration: service.duration || '', unit: service.unit || 'item', description: service.description || '', status: service.status });
    setModal({ type: 'edit', service });
  };
  const saveService = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/clinic-records/billing-catalog${modal.type === 'edit' ? `/${modal.service.id}` : ''}`, {
        method: modal.type === 'edit' ? 'PUT' : 'POST',
        headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          item_type: CATEGORY_TO_TYPE[form.category],
          category: form.category,
          unit: form.unit,
          duration: form.duration,
          description: form.description,
          unit_price: Number(form.price),
          active: form.status === 'Available',
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to save the price catalog item.');
      setModal(null);
      await loadCatalog();
    } catch (saveError) {
      setError(saveError.message || 'Unable to save the price catalog item.');
    } finally {
      setSaving(false);
    }
  };
  const saveServiceStatus = async service => {
    setError('');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/clinic-records/billing-catalog/${service.id}`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: service.name,
          item_type: service.item_type,
          category: service.category,
          unit: service.unit || 'item',
          duration: service.duration || '',
          description: service.description || '',
          unit_price: service.price,
          active: service.archived,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to update catalog availability.');
      setServices(current => current.map(item => item.id === service.id ? mapCatalogItem(payload) : item));
    } catch (statusError) {
      setError(statusError.message || 'Unable to update catalog availability.');
    }
  };

  if (!canView) {
    return <div style={s.denied}>You do not have permission to view Services Management.</div>;
  }

  return (
    <div className="services-page" style={s.page}>
      <Topbar user={user} title="Services & Price Catalog" subtitle="Maintain the clinic prices used to register consultation services and prepare invoices" />
      <div style={s.content}>
        <div style={s.summaryGrid}>
          <SummaryCard icon="tag" label="Catalog Items" value={services.length} detail={`${services.filter(service => service.status === 'Available' && !service.archived).length} available`} color="#005447" background="#e7f5f2" />
          <SummaryCard icon="pulse" label="Consultation Services" value={services.filter(service => service.category !== 'Medication' && service.category !== 'Confinement').length} detail="priced for clinical use" color="#16a34a" background="#f0fdf4" />
          <SummaryCard icon="dollar" label="Products & Medication" value={services.filter(service => ['Medication', 'Medical Supplies', 'Wound Care', 'Laboratory Supplies', 'Grooming & Hygiene', 'Surgical Equipment', 'Clinic Accessories'].includes(service.category)).length} detail="priced for prescriptions, supplies, and use" color="#9333ea" background="#faf5ff" />
          <SummaryCard icon="clock" label="Unavailable Items" value={services.filter(service => service.status === 'Unavailable' && !service.archived).length} detail={`${services.filter(service => service.archived).length} archived`} color="#d97706" background="#fffbeb" />
        </div>
        {catalogSeedMessage && <div role="status" style={{ marginBottom: 16, padding: '11px 14px', border: '1px solid #cce8da', borderRadius: 9, background: '#f0faf5', color: '#176346', fontSize: '.78rem' }}>{catalogSeedMessage}</div>}

        <section style={s.chartCard}>
          <h2 style={s.chartTitle}>Active Catalog Items by Category</h2>
          <div style={{ height: 185 }}>
            {chartData.length ? <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={120} margin={{ top: 8, right: 8, left: 18, bottom: 0 }}>
                <CartesianGrid stroke="#e8edf3" strokeDasharray="2 3" vertical />
                <XAxis dataKey="category" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#94a3b8' }} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#94a3b8' }} tickLine={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>{chartData.map(item => <Cell key={item.category} fill={item.color} />)}</Bar>
              </BarChart>
            </ResponsiveContainer> : <p style={s.empty}>Add clinic prices to populate the catalog.</p>}
          </div>
        </section>

        <div style={s.toolbar}>
          <div className="searchBox" style={s.searchBox}><span style={s.searchIcon}>{Icons.search}</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search services or medications..." /></div>
          <select value={category} onChange={event => setCategory(event.target.value)} style={s.filter}><option>All Categories</option>{Object.keys(CATEGORY_COLORS).map(item => <option key={item}>{item}</option>)}</select>
          <select value={status} onChange={event => setStatus(event.target.value)} style={s.filter}><option>All Statuses</option><option>Available</option><option>Unavailable</option></select>
          <button type="button" style={s.archiveToggle} onClick={() => setShowArchived(value => !value)}><span style={{ ...s.toggle, ...(showArchived ? s.toggleOn : {}) }}><span style={s.toggleKnob} /></span>Show Archived</button>
          <button type="button" className="services-add-button" style={s.addButton} onClick={openAdd}><span style={s.addIcon}>{Icons.plus}</span>Add Service</button>
        </div>

        <section style={s.tableCard}>
          <table className="services-table" style={s.table}>
            <thead><tr>{['Service / Item', 'Category', 'Unit Price', 'Unit', 'Duration', 'Status', 'Actions'].map(label => <th key={label}>{label}</th>)}</tr></thead>
            <tbody>
              {visibleServices.map(service => (
                <tr key={service.id}>
                  <td><div style={s.serviceName}><ServiceIcon category={service.category} /><div><strong className="service-name-text">{service.name}</strong><small className="service-description-text">{service.description}</small></div></div></td>
                  <td><CategoryBadge category={service.category} /></td>
                  <td style={s.strongCell}>₱{service.price.toLocaleString('en-PH')}</td>
                  <td>{service.unit}</td>
                  <td>{service.duration}</td>
                  <td><StatusIndicator status={service.status} /></td>
                  <td><div className="service-actions" style={s.actions}><button className="service-edit-action" type="button" title="Edit" onClick={() => openEdit(service)}>{Icons.edit}</button><button className="service-delete-action" type="button" title={service.archived ? 'Restore' : 'Archive'} onClick={() => saveServiceStatus(service)}>{Icons.trash}</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div style={s.empty}>Loading clinic price catalog…</div>}
          {!loading && !visibleServices.length && <div style={s.empty}>{error || 'No items match your filters. Add the clinic’s actual prices before recording billable services.'}</div>}
        </section>
      </div>

      {modal && <div style={s.overlay} onClick={() => setModal(null)}><form className="vi-modal vi-modal--small service-add-modal" style={{ ...s.modal, ...s.serviceModal }} onSubmit={saveService} onClick={event => event.stopPropagation()}><div style={s.modalHeader}><div><h2 className="service-modal-title">{modal.type === 'add' ? 'Add Catalog Item' : 'Edit Catalog Item'}</h2><p className="service-modal-subtitle">Use the clinic’s verified prices. These amounts are used when an item is added to a consultation invoice.</p></div><button type="button" style={s.close} onClick={() => setModal(null)}>×</button></div>{error && <div role="alert" style={s.formError}>{error}</div>}<div style={s.formGrid}><label className="service-form-label service-form-full">Item Name<span className="system-required-star">*</span><input className="service-form-control service-form-focus" required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="e.g. General Consultation" /></label><label className="service-form-label">Category<span className="system-required-star">*</span><select className="service-form-control" value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}>{Object.keys(CATEGORY_TO_TYPE).map(item => <option key={item}>{item}</option>)}</select></label><label className="service-form-label">Availability<select className="service-form-control" value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option>Available</option><option>Unavailable</option></select></label><label className="service-form-label">Unit Price (₱)<span className="system-required-star">*</span><input className="service-form-control" required type="number" min="0" step="0.01" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} placeholder="0.00" /></label><label className="service-form-label">Billing Unit<input className="service-form-control" required value={form.unit} onChange={event => setForm({ ...form, unit: event.target.value })} placeholder="item, tablet, dose, day..." /></label><label className="service-form-label">Duration / Billing period<input className="service-form-control" value={form.duration} onChange={event => setForm({ ...form, duration: event.target.value })} placeholder="e.g. 30 min or per day" /></label><label className="service-form-label service-form-full">Description<textarea className="service-form-control service-form-textarea" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Description shown to clinical staff..." /></label></div><div style={s.modalFooter}><button type="button" style={s.cancelButton} onClick={() => setModal(null)}>Cancel</button><button className="saveButton" type="submit" style={s.saveButton} disabled={saving}>{saving ? 'Saving…' : modal.type === 'add' ? 'Add Catalog Item' : 'Save Changes'}</button></div></form></div>}
    </div>
  );
}

function SummaryCard({ icon, label, value, detail, color, background }) {
  return <div className="summaryCard" style={s.summaryCard}><span style={{ ...s.summaryIcon, color, background }}><SummaryIcon type={icon} /></span><div><small className="summary-card-label">{label}</small><strong style={{ color }}>{value}</strong><em>{detail}</em></div></div>;
}

function MaterialSection({ title, items, setItems, placeholder, unitPlaceholder, buttonLabel }) {
  const addItem = () => setItems([...items, { name: '', quantity: '', unit: '' }]);
  const rows = items.length ? items : [{ name: '', quantity: '', unit: '' }];
  return <section style={s.materialSection}><div style={s.materialTitle}>{title}</div>{items.length === 0 && <em style={s.noneText}>None</em>}{rows.map((item, index) => <div key={index} style={s.materialRow}><input className="material-control" value={item.name} onChange={event => { const next = items.length ? items : [{ name: '', quantity: '', unit: '' }]; setItems(next.map((entry, itemIndex) => itemIndex === index ? { ...entry, name: event.target.value } : entry)); }} placeholder={placeholder} /><input className="material-control" value={item.quantity} onChange={event => { const next = items.length ? items : [{ name: '', quantity: '', unit: '' }]; setItems(next.map((entry, itemIndex) => itemIndex === index ? { ...entry, quantity: event.target.value } : entry)); }} placeholder="Qty" /><input className="material-control" value={item.unit} onChange={event => { const next = items.length ? items : [{ name: '', quantity: '', unit: '' }]; setItems(next.map((entry, itemIndex) => itemIndex === index ? { ...entry, unit: event.target.value } : entry)); }} placeholder={unitPlaceholder} /></div>)}<button type="button" style={s.addMaterialButton} onClick={addItem}><span>+</span>{buttonLabel}</button></section>;
}

function Detail({ label, value }) {
  return <div><small style={s.detailLabel}>{label}</small><strong style={s.detailValue}>{value}</strong></div>;
}

function MaterialDetails({ title, items }) {
  return <section className="service-material-detail"><h3>{title}</h3>{items.map(([name, quantity]) => <div key={name}><span>{name}</span><strong>{quantity}</strong></div>)}</section>;
}

const s = {
  page: { minHeight: '100%', background: '#f5f7fa', color: '#334155' },
  content: { padding: '24px 24px 44px' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 20 },
  summaryCard: { minHeight: 82, display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', border: '1px solid #e1e6ec', borderRadius: 12, background: '#fff' },
  summaryIcon: { width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 8, fontSize: 22, fontWeight: 700 },
  chartCard: { padding: '20px 20px 12px', border: '1px solid #e1e6ec', borderRadius: 12, background: '#fff', marginBottom: 20 },
  chartTitle: { margin: '0 0 16px', color: '#1e293b', fontSize: '.84rem', fontWeight: 700 },
  toolbar: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
  searchBox: { flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 11px', borderRadius: 7, background: '#eef1f5', color: '#94a3b8' },
  searchIcon: { width: 14, height: 14, display: 'flex' },
  filter: { height: 34, minWidth: 126, padding: '0 10px', border: 0, borderRadius: 7, background: '#eef1f5', color: '#475569', fontSize: '.72rem' },
  archiveToggle: { display: 'inline-flex', alignItems: 'center', gap: 7, color: '#64748b', fontSize: '.72rem', whiteSpace: 'nowrap' },
  toggle: { width: 28, height: 16, display: 'inline-flex', alignItems: 'center', padding: 2, borderRadius: 10, background: '#cbd5e1' },
  toggleOn: { background: '#005447', justifyContent: 'flex-end' },
  toggleKnob: { width: 12, height: 12, borderRadius: '50%', background: '#fff' },
  addButton: { height: 34, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 13px', borderRadius: 7, background: '#0b0b1c', color: '#fff', fontSize: '.72rem', fontWeight: 700, whiteSpace: 'nowrap' },
  addIcon: { width: 13, height: 13, display: 'flex' },
  tableCard: { overflow: 'hidden', border: '1px solid #e1e6ec', borderRadius: 10, background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '.72rem' },
  serviceName: { display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 },
  serviceIcon: { width: 15, height: 17, flexShrink: 0, display: 'flex' },
  categoryBadge: { display: 'inline-block', padding: '4px 9px', borderRadius: 7, fontSize: '.64rem', fontWeight: 700 },
  strongCell: { color: '#1e293b', fontWeight: 700 },
  itemsLink: { color: '#005447', fontSize: '.7rem', fontWeight: 600 },
  actions: { display: 'flex', alignItems: 'center', gap: 12 },
  empty: { padding: 40, color: '#64748b', textAlign: 'center', fontSize: '.8rem' },
  denied: { padding: 40, color: '#64748b' },
  overlay: { position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(15,23,42,.36)' },
  modal: { width: 'min(620px, 100%)', padding: 22, borderRadius: 12, background: '#fff', boxShadow: '0 18px 50px rgba(15,23,42,.2)' },
  viewModal: { width: 'min(520px, calc(100vw - 32px))', padding: '18px 24px 20px', borderRadius: 11, background: '#fff', boxShadow: '0 18px 50px rgba(15,23,42,.2)' },
  viewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  serviceModal: { width: 'min(550px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 28px)', overflowY: 'auto', padding: '20px 22px 18px' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  close: { color: '#64748b', fontSize: 24, lineHeight: 1 },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 20, padding: '16px 0', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' },
  detailLabel: { display: 'block', marginBottom: 5, color: '#94a3b8', fontSize: '.65rem' },
  detailValue: { color: '#334155', fontSize: '.78rem' },
  description: { margin: '16px 0 0', color: '#64748b', fontSize: '.76rem', lineHeight: 1.5 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 14, rowGap: 12 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  cancelButton: { padding: '8px 13px', border: '1px solid #cbd5e1', borderRadius: 6, color: '#111827', fontSize: '.72rem' },
  saveButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 130, padding: '8px 13px', borderRadius: 6, background: '#08081a', color: '#fff', fontSize: '.72rem', fontWeight: 700 },
  materialSection: { marginTop: 14, padding: '12px 12px 11px', border: '1px solid #dbe1e8', borderRadius: 10 },
  materialTitle: { color: '#334155', fontSize: '.67rem', fontWeight: 600, letterSpacing: '.04em' },
  noneText: { display: 'block', margin: '7px 0 6px', color: '#64748b', fontSize: '.68rem' },
  materialRow: { display: 'grid', gridTemplateColumns: '1.2fr .8fr 1.2fr', gap: 8, marginTop: 7 },
  addMaterialButton: { display: 'inline-flex', alignItems: 'center', gap: 9, marginTop: 8, padding: '7px 11px', border: '1px solid #dbe3ee', borderRadius: 7, color: '#111827', fontSize: '.72rem', fontWeight: 600 },
};
