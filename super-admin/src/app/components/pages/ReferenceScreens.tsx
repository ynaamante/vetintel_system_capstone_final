import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
  Shield,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';

const shell = 'p-5 space-y-4 bg-[#fafbf8] min-h-full';
const card = 'bg-white rounded-lg border border-[#d4e3d7]';
const button = 'rounded-lg px-4 py-2 text-xs font-semibold';
type PlanFeature = string | { name: string; description?: string; type?: 'included' | 'addon' };
const planFeatureName = (feature: PlanFeature) => typeof feature === 'string' ? feature : feature.name;

const apiFetch = (path: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('vetintel_token');
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
};

export function ActiveClinics() {
  type ActiveClinic = {
    id: number;
    name: string;
    owner: string;
    staff: string;
    plan: string;
    status: 'Active' | 'Suspended' | 'Pending Activation';
    date: string;
    email: string;
    phone: string;
    address: string;
    expiry: string;
    monthlyPrice: string;
    requestedRoles: Array<{ role: string; count: number }>;
  };

  const [clinics, setClinics] = useState<ActiveClinic[]>([]);
  const [selectedClinic, setSelectedClinic] = useState<ActiveClinic | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ActiveClinic['status'] | 'Archived'>('All');
  const [notice, setNotice] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  useEffect(() => {
    Promise.all([apiFetch('/api/clinics'), apiFetch('/api/subscription-plans')])
      .then(async ([clinicsResponse, plansResponse]) => {
        if (!clinicsResponse.ok) throw new Error('Failed to load clinics');
        if (!plansResponse.ok) throw new Error('Failed to load subscription plan prices');
        return Promise.all([clinicsResponse.json(), plansResponse.json()]);
      })
      .then(([data, plans]) => {
        const mappedClinics = data.map((clinic: any) => {
          const clinicPlan = clinic.metadata?.application?.plan || clinic.metadata?.plan || '';
          const subscribedPlan = plans.find((plan: any) => String(plan.name).trim().toLowerCase() === String(clinicPlan).trim().toLowerCase());
          return {
            id: clinic.id,
            name: clinic.name,
            owner: clinic.owner || 'Unknown',
            staff: String(clinic.metadata?.application?.staffCount ?? clinic.total_users ?? 0),
            plan: clinicPlan || '—',
            monthlyPrice: subscribedPlan?.price ? String(subscribedPlan.price) : '',
            status: clinic.status === 'active' ? 'Active' : clinic.status === 'pending' ? 'Pending Activation' : 'Suspended',
            date: clinic.created_at ? new Date(clinic.created_at).toLocaleDateString() : '—',
            email: clinic.email || '',
            phone: clinic.phone || '',
            address: clinic.address || '',
            expiry: clinic.metadata?.subscriptionExpiry || 'Not set',
            requestedRoles: Array.isArray(clinic.metadata?.application?.requestedRoles)
              ? clinic.metadata.application.requestedRoles.map((item: any) => ({
                role: item.role || 'Unspecified role',
                count: Number(item.count) || 0,
              }))
              : [],
          };
        });
        setClinics(mappedClinics);
      })
      .catch(error => showNotice(error instanceof Error ? error.message : 'Failed to load clinics', 'error'));
  }, []);

  const showNotice = (message: string, kind: 'success' | 'error') => {
    setNotice({ message, kind });
    setTimeout(() => setNotice(null), 3500);
  };

  const updateStatus = (status: ActiveClinic['status'], message: string) => {
    if (!selectedClinic) return;
    const apiStatus = status === 'Active' ? 'active' : status === 'Suspended' ? 'suspended' : 'pending';
    const token = localStorage.getItem('vetintel_token');
    fetch(`/api/clinics/${selectedClinic.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ status: apiStatus }),
    }).then(async response => {
      if (!response.ok) throw new Error('Failed to update clinic status');
      setClinics(current => current.map(clinic => clinic.id === selectedClinic.id ? { ...clinic, status } : clinic));
      showNotice(message, 'success');
      setSelectedClinic(null);
    }).catch(error => showNotice(error instanceof Error ? error.message : 'Failed to update clinic status', 'error'));
  };

  const statusTabs: Array<'All' | ActiveClinic['status'] | 'Archived'> = ['All', 'Active', 'Pending Activation', 'Suspended', 'Archived'];
  const filteredClinics = clinics.filter(clinic => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${clinic.name} ${clinic.owner}`.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'All' || clinic.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const formattedPlanPrice = (price: string) => {
    if (!price) return 'Not set';
    return /^[₱$€£]/.test(price.trim()) ? price : `₱${price}`;
  };

  return (
    <div className={shell}>
      {notice && (
        <div className={`fixed right-6 top-16 z-50 flex items-center gap-3 rounded-xl border px-5 py-3 text-sm shadow-lg ${
          notice.kind === 'success' ? 'border-[#7ce3af] bg-[#f0fff6] text-[#172b24]' : 'border-[#ff8a8a] bg-[#fff8f8] text-[#172b24]'
        }`}>
          <span className={`text-lg ${notice.kind === 'success' ? 'text-[#079669]' : 'text-[#ef3030]'}`}>{notice.kind === 'success' ? '✓' : 'ⓘ'}</span>
          {notice.message}
        </div>
      )}

      <div className="overflow-visible rounded-xl border border-[#d4e3d7] bg-gradient-to-br from-white via-[#f7fbf8] to-[#eff8f2]">
        <div className="relative z-10 flex items-center gap-2 overflow-x-auto px-3 py-2">
          {statusTabs.map(tab => {
            const count = tab === 'All' ? clinics.length : clinics.filter(clinic => clinic.status === tab).length;
            const active = statusFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'border-[#086b50] bg-[#086b50] text-white' : 'border-[#dce9e1] bg-white/80 text-[#344c43] hover:bg-[#eff8f2]'}`}
              >
                {tab}<span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${active ? 'bg-white/20 text-white' : 'bg-[#e7f4ec] text-[#526B62]'}`}>{count}</span>
              </button>
            );
          })}
        </div>
        <div aria-hidden="true" className="mx-3 h-px bg-[#dcebe2]" />
        <div className="relative z-10 flex flex-wrap items-center gap-3 px-3 py-2">
          <div className="relative min-w-[220px] max-w-[600px] flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6faf91]" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search clinics..." className="w-full rounded-full border border-[#d4e3d7] bg-white/90 py-2 pl-9 pr-3 text-xs text-[#172b24] placeholder:text-[#789087] outline-none focus:border-[#086b50] focus:ring-2 focus:ring-[#086b50]/20" />
          </div>
        </div>
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-[#d4e3d7] bg-gradient-to-r from-[#013826] to-[#086b50] px-4 py-3">
          <h2 className="text-sm font-semibold text-white">All Clinics</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#e7f4ec]">
              <tr>{['Clinic Name', 'Owner Name', 'Staff Req.', 'Plan', 'Status', 'Submitted', ''].map((heading, index) => <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#244b3e]" key={heading || `action-${index}`}>{heading}</th>)}</tr>
            </thead>
            <tbody>
              {filteredClinics.map((clinic) => (
                <tr
                  className="cursor-pointer border-t border-[#e6eee9] transition-colors hover:bg-[#f0f8f3] focus-within:bg-[#f0f8f3]"
                  key={clinic.id}
                  tabIndex={0}
                  aria-label={`Open details for ${clinic.name}`}
                  onClick={() => setSelectedClinic(clinic)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedClinic(clinic);
                    }
                  }}
                >
                  <td className="px-4 py-3 text-sm font-medium text-[#172b24]"><button type="button" onClick={() => setSelectedClinic(clinic)} className="block w-full text-left">{clinic.name}{clinic.expiry === 'Expired' && <span className="ml-2 rounded bg-[#fff1c9] px-1.5 py-1 text-[10px] text-[#c98200]">Expired</span>}{clinic.name === 'Metro Pet Care Center' && <span className="ml-2 rounded bg-[#fff1c9] px-1.5 py-1 text-[10px] text-[#c98200]">Exp. 12d</span>}</button></td>
                  <td className="px-4 py-3 text-sm text-[#526B62]"><button type="button" onClick={() => setSelectedClinic(clinic)} className="block w-full text-left">{clinic.owner}</button></td>
                  <td className="px-4 py-3 text-sm text-[#526B62]"><button type="button" onClick={() => setSelectedClinic(clinic)} className="block w-full text-left">{clinic.staff}</button></td>
                  <td className="px-4 py-3 text-sm text-[#526B62]"><button type="button" onClick={() => setSelectedClinic(clinic)} className="block w-full text-left">{clinic.plan}</button></td>
                  <td className="px-4 py-3 text-sm"><button type="button" onClick={() => setSelectedClinic(clinic)} className="block w-full text-left"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${clinic.status === 'Active' ? 'bg-[#d8f7e9] text-[#078c63]' : clinic.status === 'Suspended' ? 'bg-[#ffe0e0] text-[#c43636]' : 'bg-[#fff1c9] text-[#c98200]'}`}>{clinic.status}</span></button></td>
                  <td className="px-4 py-3 text-sm text-[#526B62]"><button type="button" onClick={() => setSelectedClinic(clinic)} className="block w-full text-left">{clinic.date}</button></td>
                  <td className="px-4 py-3 text-center"><button type="button" onClick={event => { event.stopPropagation(); setSelectedClinic(clinic); }} aria-label={`View ${clinic.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#086b50] transition hover:bg-[#e7f4ec]"><ChevronRight className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedClinic && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-[min(560px,calc(100vh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-[#013826] to-[#087a59] px-5 py-3 text-white">
              <h2 className="text-sm font-semibold">{selectedClinic.name} Details</h2>
              <button onClick={() => setSelectedClinic(null)} className="text-xl leading-none transition hover:text-[#d4e9df]" aria-label="Close clinic details">×</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfdfb] p-4 sm:p-5">
              {selectedClinic.name === 'Metro Pet Care Center' && (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#e7c985] bg-[#fffaf0] px-4 py-3 text-sm text-[#a45b00]">
                  <span>Plan expiring in 12 days (Sep 15, 2026).</span>
                  <button onClick={() => showNotice(`Expiry notification sent to ${selectedClinic.name}.`, 'success')} className="shrink-0 rounded-full bg-[#df7a00] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#c96d00]">Notify Clinic</button>
                </div>
              )}
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <section className="overflow-hidden rounded-xl border border-[#d4e3d7] bg-white">
                    <h3 className="border-b border-[#d4e3d7] bg-gradient-to-r from-[#e7f4ec] to-[#dff4e9] px-4 py-2.5 text-sm font-bold text-[#07543d]">Clinic Information</h3>
                    <div className="space-y-2 p-4 text-sm text-[#172b24]">
                      <p>Clinic Name: <span className="text-[#526B62]">{selectedClinic.name}</span></p>
                      <p>Address: <span className="text-[#526B62]">{selectedClinic.address}</span></p>
                      <p>Email: <span className="text-[#526B62]">{selectedClinic.email}</span></p>
                      <p>Phone: <span className="text-[#526B62]">{selectedClinic.phone}</span></p>
                      <p>Registered: <span className="text-[#526B62]">{selectedClinic.date}</span></p>
                    </div>
                  </section>
                  <section className="overflow-hidden rounded-xl border border-[#d4e3d7] bg-white">
                    <h3 className="border-b border-[#d4e3d7] bg-gradient-to-r from-[#e7f4ec] to-[#dff4e9] px-4 py-2.5 text-sm font-bold text-[#07543d]">Subscription</h3>
                    <div className="space-y-2 p-4 text-sm text-[#172b24]">
                      <p>Plan: <span className="text-[#526B62]">{selectedClinic.plan}</span></p>
                      <p>Price: <span className="text-[#526B62]">{formattedPlanPrice(selectedClinic.monthlyPrice)}{selectedClinic.monthlyPrice ? '/mo' : ''}</span></p>
                      <p>Plan Status: <span className="text-[#526B62]">{selectedClinic.status}</span></p>
                      <p>Expiry Date: <span className="text-[#526B62]">{selectedClinic.expiry}</span></p>
                      <p>Total Staff: <span className="text-[#526B62]">{selectedClinic.staff}</span></p>
                    </div>
                  </section>
                </div>
                <section className="overflow-hidden rounded-xl border border-[#d4e3d7] bg-white">
                  <div className="flex justify-between border-b border-[#d4e3d7] bg-gradient-to-r from-[#e7f4ec] to-[#dff4e9] px-4 py-2.5 text-sm font-bold text-[#07543d]">
                    <span>Requested Staff Structure</span>
                    <span className="font-normal text-[#526B62]">{selectedClinic.staff} staff slots</span>
                  </div>
                  {selectedClinic.requestedRoles.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-[#526B62]">No requested staff roles were submitted.</p>
                  ) : (
                    selectedClinic.requestedRoles.map(staff => (
                      <div className="grid grid-cols-3 border-b border-[#e2eee7] px-4 py-3 text-sm last:border-0" key={staff.role}>
                        <span className="text-[#172b24]">{staff.role}</span>
                        <span className="text-[#526B62]">{staff.count} {staff.count === 1 ? 'slot' : 'slots'}</span>
                        <span className="text-[#078c63]">Requested</span>
                      </div>
                    ))
                  )}
                </section>
                <section className="overflow-hidden rounded-xl border border-[#d4e3d7] bg-white">
                  <h3 className="border-b border-[#d4e3d7] bg-gradient-to-r from-[#e7f4ec] to-[#dff4e9] px-4 py-2.5 text-sm font-bold text-[#07543d]">Change Status</h3>
                  <div className="flex gap-2 p-4">
                    <button onClick={() => updateStatus('Suspended', `${selectedClinic.name} has been suspended.`)} className="rounded-full bg-[#df7a00] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#c96d00]">Suspend</button>
                    <button onClick={() => updateStatus('Suspended', `${selectedClinic.name} has been archived.`)} className="rounded-full bg-[#526b62] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#344c43]">Archive</button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export function RoleRequests() {
  type RoleRequest = {
    id: number;
    clinic: string;
    owner: string;
    role: string;
    users: string;
    date: string;
    submittedAt: string;
    status: 'Pending' | 'Under Review' | 'Approved' | 'Assigned' | 'Rejected';
    reason: string;
    ownerEmail?: string;
    ownerPhone?: string;
    clinicAddress?: string;
    reviewerName?: string;
    reviewerEmail?: string;
    reviewedAt?: string;
  };
  const navigate = useNavigate();
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RoleRequest | null>(null);
  const [notice, setNotice] = useState<{ message: string; kind: 'success' | 'error' | 'info' } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | RoleRequest['status']>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const showNotice = (message: string, kind: 'success' | 'error' | 'info') => {
    setNotice({ message, kind });
    window.setTimeout(() => setNotice(null), 3500);
  };

  useEffect(() => {
    apiFetch('/api/role-requests').then(async response => {
      if (!response.ok) throw new Error('Failed to load role requests');
      return response.json();
    }).then(data => setRequests(data.map((item: any) => ({
      id: item.id, clinic: item.clinic || item.clinic_name || 'Unknown clinic',
      owner: item.owner || '—',
      role: item.role || item.requested_role || '—', users: String(item.users || item.requested_users || 1),
      date: item.created_at ? new Date(item.created_at).toLocaleDateString() : '—',
      submittedAt: item.created_at || '',
      status: String(item.status || 'Pending').toLowerCase() === 'approved' ? 'Approved'
        : String(item.status || '').toLowerCase() === 'assigned' ? 'Assigned'
          : String(item.status || '').toLowerCase() === 'rejected' ? 'Rejected'
            : String(item.status || '').toLowerCase() === 'under review' ? 'Under Review' : 'Pending',
      reason: item.reason || '',
    })))).catch(error => showNotice(error instanceof Error ? error.message : 'Failed to load role requests', 'error'));
  }, []);

  const statusTabs: Array<'All' | RoleRequest['status']> = ['All', 'Pending', 'Approved', 'Assigned', 'Rejected'];
  const visibleRequests = requests.filter(request => {
    const matchesStatus = statusFilter === 'All' || request.status === statusFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || [request.clinic, request.owner, request.role, request.status].some(value => value.toLowerCase().includes(query));
    const submittedDate = request.submittedAt ? new Date(request.submittedAt) : null;
    const dateValue = submittedDate && !Number.isNaN(submittedDate.getTime())
      ? `${submittedDate.getFullYear()}-${String(submittedDate.getMonth() + 1).padStart(2, '0')}-${String(submittedDate.getDate()).padStart(2, '0')}`
      : '';
    const matchesFrom = !dateFrom || (!!dateValue && dateValue >= dateFrom);
    const matchesTo = !dateTo || (!!dateValue && dateValue <= dateTo);
    return matchesStatus && matchesSearch && matchesFrom && matchesTo;
  });

  const updateRequest = (status: RoleRequest['status'], message: string, kind: 'success' | 'error' | 'info') => {
    if (!selectedRequest) return;
    apiFetch(`/api/role-requests/${selectedRequest.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      .then(async response => { if (!response.ok) throw new Error('Failed to update role request'); })
      .then(() => {
        setRequests(current => current.map(request => request.id === selectedRequest.id ? { ...request, status } : request));
        setSelectedRequest(null);
        showNotice(message, kind);
        if (status === 'Approved') {
          window.sessionStorage.setItem('roleManagementToast', message);
          navigate('/users');
        }
      }).catch(error => showNotice(error instanceof Error ? error.message : 'Failed to update role request', 'error'));
  };

  const openRequestDetails = async (request: RoleRequest) => {
    setSelectedRequest(request);
    try {
      const response = await apiFetch(`/api/role-requests/${request.id}`);
      if (!response.ok) throw new Error('Failed to load role request details');
      const detail = await response.json();
      setSelectedRequest(current => current?.id === request.id ? {
        ...current,
        clinic: detail.resolved_clinic_name || detail.clinic_name || current.clinic,
        owner: detail.owner || current.owner,
        ownerEmail: detail.owner_email || '—',
        ownerPhone: detail.owner_phone || '—',
        clinicAddress: detail.clinic_address || '—',
        reviewerName: detail.reviewer_name || '',
        reviewerEmail: detail.reviewer_email || '',
        reviewedAt: detail.reviewed_at || '',
        reason: detail.reason || current.reason,
      } : current);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Failed to load role request details', 'error');
    }
  };

  const formattedDate = (value?: string) => {
    if (!value) return '—';
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? '—' : parsedDate.toLocaleDateString();
  };

  const statusClass = (status: RoleRequest['status']) => status === 'Approved' ? 'text-[#078c63]' : status === 'Rejected' ? 'text-[#c43636]' : 'text-[#c98200]';

  return (
    <div className={`${shell} space-y-5`}>
      {notice && (
        <div className={`fixed right-6 top-6 z-[100] flex items-center gap-3 rounded-xl border px-5 py-3 text-sm shadow-lg ${
          notice.kind === 'success' ? 'border-[#7ce3af] bg-[#f0fff6]' : notice.kind === 'error' ? 'border-[#ff8a8a] bg-[#fff8f8]' : 'border-[#82b5ff] bg-[#f0f7ff]'
        }`}>
          <span className={`text-lg ${notice.kind === 'success' ? 'text-[#079669]' : notice.kind === 'error' ? 'text-[#ef3030]' : 'text-[#086b50]'}`}>{notice.kind === 'success' ? '✓' : notice.kind === 'error' ? 'ⓘ' : 'ⓘ'}</span>
          {notice.message}
        </div>
      )}
      <div className="mb-3 overflow-visible rounded-xl border border-[#d4e3d7] bg-gradient-to-br from-white via-[#f7fbf8] to-[#eff8f2]">
        <div className="relative z-10 flex items-center gap-2 overflow-x-auto px-3 py-2">
          {statusTabs.map(tab => {
            const count = tab === 'All' ? requests.length : requests.filter(request => request.status === tab).length;
            const active = statusFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'border-[#086b50] bg-[#086b50] text-white' : 'border-[#dce9e1] bg-white/80 text-[#344c43] hover:bg-[#eff8f2]'}`}
              >
                {tab}<span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${active ? 'bg-white/20 text-white' : 'bg-[#e7f4ec] text-[#526B62]'}`}>{count}</span>
              </button>
            );
          })}
        </div>
        <div aria-hidden="true" className="mx-3 h-px bg-[#dcebe2]" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-3 py-2">
          <div className="relative min-w-[220px] max-w-[600px] flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6faf91]" />
            <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search requests..." className="w-full rounded-full border border-[#d4e3d7] bg-white/90 py-2 pl-9 pr-3 text-xs text-[#172b24] placeholder:text-[#789087] outline-none focus:border-[#086b50] focus:ring-2 focus:ring-[#086b50]/20" />
          </div>
          <div className="relative">
            <button onClick={() => setDateRangeOpen(open => !open)} className="inline-flex items-center gap-2 rounded-full border border-[#d4e3d7] bg-white/90 px-3 py-2 text-xs font-medium text-[#40594f] transition hover:bg-[#f7fbf8]">
              <CalendarDays className="h-4 w-4 text-[#078c63]" />
              {dateFrom || dateTo ? `${dateFrom || 'Start'} – ${dateTo || 'End'}` : 'Select Date Range'}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${dateRangeOpen ? 'rotate-180' : ''}`} />
            </button>
            {dateRangeOpen && (
              <div className="absolute right-0 top-full z-30 mt-2 grid w-64 gap-3 rounded-xl border border-[#d4e3d7] bg-white p-3 shadow-lg">
                <label className="grid gap-1 text-[11px] text-[#526B62]">From<input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} className="rounded-lg border border-[#d4e3d7] px-2 py-1.5 text-xs text-[#172b24] focus:border-[#086b50] focus:outline-none" /></label>
                <label className="grid gap-1 text-[11px] text-[#526B62]">To<input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} className="rounded-lg border border-[#d4e3d7] px-2 py-1.5 text-xs text-[#172b24] focus:border-[#086b50] focus:outline-none" /></label>
                <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="justify-self-end text-xs font-medium text-[#086b50] hover:underline">Clear dates</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-gradient-to-r from-[#013826] to-[#086b50]">
              <tr>
                {['Requested Role', 'Owner', 'Requested Users', 'Request Date', 'Status', ''].map((heading, index) => (
                  <th key={heading || `action-${index}`} className="px-4 py-3 text-xs font-semibold text-white">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRequests.map(request => (
                <tr
                  key={request.id}
                  tabIndex={0}
                  aria-label={`Open role request for ${request.clinic}, ${request.role}`}
                  onClick={() => openRequestDetails(request)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openRequestDetails(request);
                    }
                  }}
                  className="cursor-pointer border-t border-[#e6eee9] transition-colors hover:bg-[#f0f8f3] focus-visible:bg-[#f0f8f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#078c63]"
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-[#172b24]">{request.clinic}</p>
                    <p className="mt-0.5 text-xs text-[#078c63]">{request.role}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#40594f]">{request.owner}</td>
                  <td className="px-4 py-3 text-sm text-[#40594f]">{request.users}</td>
                  <td className="px-4 py-3 text-sm text-[#40594f]">{request.date}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                      request.status === 'Approved' ? 'bg-[#d8f7e9] text-[#078c63]' :
                      request.status === 'Rejected' ? 'bg-[#ffe0e0] text-[#c43636]' :
                      request.status === 'Under Review' ? 'bg-[#e7f4ec] text-[#086b50]' :
                      'bg-[#fff1c9] text-[#c98200]'
                    }`}>{request.status}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button type="button" onClick={event => { event.stopPropagation(); openRequestDetails(request); }} aria-label={`View ${request.clinic} ${request.role} request`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#087a59] transition hover:bg-[#d8f7e9]">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {visibleRequests.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#789087]">No role requests match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {selectedRequest && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="role-request-details-title" className="flex h-[min(560px,calc(100vh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-[#013826] to-[#087a59] px-4 py-3 text-white">
              <h2 id="role-request-details-title" className="text-sm font-semibold">Role Request Details</h2>
              <button onClick={() => setSelectedRequest(null)} aria-label="Close role request details" className="text-2xl leading-none text-white/90 transition hover:text-white">×</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfdfb] p-4 sm:p-5">
              <div className="grid gap-3 md:grid-cols-2">
              <section className="overflow-hidden rounded-xl border border-[#d4e3d7] bg-white">
                <h3 className="border-b border-[#d4e3d7] bg-[#e7f4ec] px-4 py-2.5 text-sm font-semibold text-[#07543d]">Request Information</h3>
                <dl className="grid grid-cols-[minmax(130px,0.8fr)_1.2fr] gap-x-3 gap-y-2 p-4 text-xs sm:text-sm">
                  <dt className="font-medium text-[#526B62]">Request ID</dt><dd className="text-[#172b24]">#{selectedRequest.id}</dd>
                  <dt className="font-medium text-[#526B62]">Clinic Name</dt><dd className="text-[#172b24]">{selectedRequest.clinic}</dd>
                  <dt className="font-medium text-[#526B62]">Requested Role</dt><dd className="text-[#172b24]">{selectedRequest.role}</dd>
                  <dt className="font-medium text-[#526B62]">Number of Users</dt><dd className="text-[#172b24]">{selectedRequest.users}</dd>
                  <dt className="font-medium text-[#526B62]">Date Submitted</dt><dd className="text-[#172b24]">{selectedRequest.date}</dd>
                  <dt className="font-medium text-[#526B62]">Current Status</dt>
                  <dd><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                    selectedRequest.status === 'Approved' || selectedRequest.status === 'Assigned' ? 'bg-[#d8f7e9] text-[#078c63]' :
                    selectedRequest.status === 'Rejected' ? 'bg-[#ffe0e0] text-[#c43636]' :
                    selectedRequest.status === 'Under Review' ? 'bg-[#e7f4ec] text-[#086b50]' :
                    'bg-[#fff1c9] text-[#c98200]'
                  }`}>{selectedRequest.status}</span></dd>
                </dl>
              </section>
              <section className="overflow-hidden rounded-xl border border-[#d4e3d7] bg-white">
                <h3 className="border-b border-[#d4e3d7] bg-[#e7f4ec] px-4 py-2.5 text-sm font-semibold text-[#07543d]">Clinic Information</h3>
                <dl className="grid grid-cols-[minmax(130px,0.8fr)_1.2fr] gap-x-3 gap-y-2 p-4 text-xs sm:text-sm">
                  <dt className="font-medium text-[#526B62]">Clinic Owner</dt><dd className="text-[#172b24]">{selectedRequest.owner}</dd>
                  <dt className="font-medium text-[#526B62]">Owner's Email</dt><dd className="break-all text-[#172b24]">{selectedRequest.ownerEmail || '—'}</dd>
                  <dt className="font-medium text-[#526B62]">Contact Number</dt><dd className="text-[#172b24]">{selectedRequest.ownerPhone || '—'}</dd>
                  <dt className="font-medium text-[#526B62]">Clinic Address</dt><dd className="text-[#172b24]">{selectedRequest.clinicAddress || '—'}</dd>
                </dl>
              </section>
              <section className="overflow-hidden rounded-xl border border-[#d4e3d7] bg-white">
                <h3 className="border-b border-[#d4e3d7] bg-[#e7f4ec] px-4 py-2.5 text-sm font-semibold text-[#07543d]">Requested User Information</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-[#f2f8f4] text-[#40594f]"><tr><th className="px-3 py-2 font-semibold">Full Name</th><th className="px-3 py-2 font-semibold">Email Address</th><th className="px-3 py-2 font-semibold">Requested Role</th></tr></thead>
                    <tbody><tr className="border-t border-[#e6eee9]"><td className="px-3 py-2.5 text-[#172b24]">Not provided</td><td className="px-3 py-2.5 text-[#526B62]">Not provided</td><td className="px-3 py-2.5 text-[#172b24]">{selectedRequest.role}</td></tr></tbody>
                  </table>
                </div>
                <p className="px-3 pb-3 text-[11px] text-[#789087]">The request contains a user count, but individual user names and email addresses were not provided.</p>
              </section>
              <section className="overflow-hidden rounded-xl border border-[#d4e3d7] bg-white">
                <h3 className="border-b border-[#d4e3d7] bg-[#e7f4ec] px-4 py-2.5 text-sm font-semibold text-[#07543d]">Request Justification</h3>
                <dl className="grid grid-cols-[minmax(125px,0.8fr)_1.2fr] gap-x-3 gap-y-3 p-4 text-xs sm:text-sm">
                  <dt className="font-medium text-[#526B62]">Reason for Request</dt><dd className="text-[#172b24]">{selectedRequest.reason || '—'}</dd>
                  <dt className="font-medium text-[#526B62]">Additional Remarks</dt><dd className="text-[#172b24]">No additional remarks recorded.</dd>
                </dl>
              </section>
              <section className="overflow-hidden rounded-xl border border-[#d4e3d7] bg-white md:col-span-2">
                <h3 className="border-b border-[#d4e3d7] bg-[#e7f4ec] px-4 py-2.5 text-sm font-semibold text-[#07543d]">Review History</h3>
                {selectedRequest.reviewedAt ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-[#f2f8f4] text-[#40594f]"><tr><th className="px-3 py-2 font-semibold">Reviewed By</th><th className="px-3 py-2 font-semibold">Date Reviewed</th><th className="px-3 py-2 font-semibold">Admin Remarks</th><th className="px-3 py-2 font-semibold">Previous Status</th></tr></thead>
                      <tbody><tr className="border-t border-[#e6eee9]"><td className="px-3 py-2.5 text-[#172b24]">{selectedRequest.reviewerName || selectedRequest.reviewerEmail || 'Admin'}</td><td className="px-3 py-2.5 text-[#526B62]">{formattedDate(selectedRequest.reviewedAt)}</td><td className="px-3 py-2.5 text-[#526B62]">—</td><td className="px-3 py-2.5 text-[#526B62]">—</td></tr></tbody>
                    </table>
                  </div>
                ) : <p className="px-4 py-3 text-sm text-[#789087]">No review history recorded.</p>}
              </section>
              {(selectedRequest.status === 'Pending' || selectedRequest.status === 'Under Review') && (
                <section className="overflow-hidden rounded-xl border border-[#d4e3d7] bg-white md:col-span-2">
                  <h3 className="border-b border-[#d4e3d7] bg-[#e7f4ec] px-4 py-2.5 text-sm font-semibold text-[#07543d]">Review Actions</h3>
                  <div className="flex flex-wrap gap-2 p-4">
                    <button onClick={() => updateRequest('Approved', `Role request approved for ${selectedRequest.clinic}.`, 'success')} className="rounded-full bg-[#087a59] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#065c44]">Approve Request</button>
                    <button onClick={() => updateRequest('Rejected', `Role request rejected for ${selectedRequest.clinic}.`, 'error')} className="rounded-full border border-[#c43636] bg-white px-4 py-2 text-xs font-semibold text-[#c43636] transition hover:bg-[#fff1f1]">Reject Request</button>
                  </div>
                </section>
              )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export function SubscriptionPlans() {
  type Plan = {
    id?: number;
    name: string;
    description: string;
    price: string;
    annualPrice: string;
    staffLimit: string;
    features: PlanFeature[];
    active: boolean;
    subscribedClinics: number;
  };
  type PlanClinic = {
    id: number;
    name: string;
    owner: string;
    email: string;
    phone: string;
    address: string;
    subscriptionDate: string;
    expirationDate: string;
    status: string;
  };
  const [plans, setPlans] = useState<Plan[]>([]);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [createForm, setCreateForm] = useState<Plan>({
    name: '',
    description: '',
    price: '$',
    annualPrice: '',
    staffLimit: '5',
    features: [],
    active: true,
    subscribedClinics: 0,
  });
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editForm, setEditForm] = useState<Plan | null>(null);
  const [viewingPlan, setViewingPlan] = useState<Plan | null>(null);
  const [planClinics, setPlanClinics] = useState<PlanClinic[]>([]);
  const [selectedPlanClinic, setSelectedPlanClinic] = useState<PlanClinic | null>(null);
  const [planModalPage, setPlanModalPage] = useState<'details' | 'subscribers' | 'clinic-details'>('details');
  const [planDetailTab, setPlanDetailTab] = useState<'overview' | 'clinics'>('overview');
  const [clinicSearch, setClinicSearch] = useState('');
  const [planClinicStatusFilter, setPlanClinicStatusFilter] = useState('All');
  const [planClinicStatusOpen, setPlanClinicStatusOpen] = useState(false);
  const [planClinicPage, setPlanClinicPage] = useState(1);
  const planClinicStatusRef = useRef<HTMLDivElement>(null);
  const [loadingPlanDetails, setLoadingPlanDetails] = useState(false);
  const [newFeature, setNewFeature] = useState('');
  const [newFeatureDescription, setNewFeatureDescription] = useState('');
  const [newFeatureType, setNewFeatureType] = useState<'included' | 'addon' | ''>('');
  const [addingEditFeature, setAddingEditFeature] = useState(false);
  const [notice, setNotice] = useState<{ message: string; kind: 'success' | 'info' } | null>(null);

  const showNotice = (message: string, kind: 'success' | 'info') => {
    setNotice({ message, kind });
    window.setTimeout(() => setNotice(null), 3500);
  };

  useEffect(() => {
    apiFetch('/api/subscription-plans').then(async response => {
      if (!response.ok) throw new Error('Failed to load subscription plans');
      return response.json();
    }).then(data => setPlans(data.map((item: any) => ({
      id: item.id, name: item.name, description: item.description || '', price: String(item.price || ''),
      annualPrice: String(item.annual_price || item.annualPrice || ''),
      staffLimit: Number(item.staff_limit ?? item.staffLimit) === 0
        ? 'Unlimited'
        : String(item.staff_limit ?? item.staffLimit ?? ''),
      features: item.features || [], active: item.status !== 'inactive',
      subscribedClinics: Number(item.subscribed_clinics) || 0,
    })))).catch(error => showNotice(error instanceof Error ? error.message : 'Failed to load subscription plans', 'info'));
  }, []);

  useEffect(() => {
    if (!planClinicStatusOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !planClinicStatusRef.current?.contains(event.target)) {
        setPlanClinicStatusOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [planClinicStatusOpen]);

  const openEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setEditForm({ ...plan, features: [...plan.features] });
    setNewFeature('');
    setNewFeatureDescription('');
    setNewFeatureType('');
    setAddingEditFeature(false);
  };

  const openCreatePlan = () => {
    setCreateForm({ name: '', description: '', price: '', annualPrice: '', staffLimit: '5', features: [], active: true, subscribedClinics: 0 });
    setNewFeature('');
    setCreatingPlan(true);
  };

  const formatPrice = (price: string) => {
    if (!price) return 'Not set';
    return /^[₱$€£]/.test(price.trim()) ? price : `₱${price}`;
  };

  const openPlanDetails = async (plan: Plan) => {
    setViewingPlan(plan);
    setPlanModalPage('details');
    setPlanDetailTab('clinics');
    setClinicSearch('');
    setPlanClinicStatusFilter('All');
    setPlanClinicPage(1);
    setSelectedPlanClinic(null);
    setPlanClinics([]);
    setLoadingPlanDetails(true);
    const clinicsResult = await Promise.allSettled([
      apiFetch('/api/clinics').then(async response => {
        if (!response.ok) throw new Error('Failed to load subscribed clinics');
        return response.json();
      }),
    ]).then(results => results[0]);

    if (clinicsResult.status === 'fulfilled') {
      const clinicRows = clinicsResult.value
        .filter((clinic: any) => {
          const clinicPlan = clinic.metadata?.application?.plan || clinic.metadata?.plan || '';
          return String(clinicPlan).trim().toLowerCase() === plan.name.trim().toLowerCase();
        })
        .map((clinic: any) => {
          const rawExpiry = clinic.metadata?.subscriptionExpiry || clinic.metadata?.subscription_expiry || '';
          const expiry = rawExpiry ? new Date(rawExpiry) : null;
          const clinicStatus = String(clinic.status || clinic.metadata?.status || 'Active');
          const status = expiry && !Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now()
            ? 'Expired'
            : clinicStatus.charAt(0).toUpperCase() + clinicStatus.slice(1).toLowerCase();
          return {
            id: Number(clinic.id),
            name: clinic.name || 'Unnamed clinic',
            owner: clinic.metadata?.application?.ownerName || clinic.owner || '—',
            email: clinic.metadata?.application?.ownerEmail || clinic.email || '—',
            phone: clinic.metadata?.application?.ownerPhone || clinic.phone || '—',
            address: clinic.address || '—',
            subscriptionDate: clinic.created_at ? new Date(clinic.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }) : '—',
            expirationDate: expiry && !Number.isNaN(expiry.getTime()) ? expiry.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }) : '—',
            status,
          };
        });
      setPlanClinics(clinicRows);
    } else {
      showNotice(clinicsResult.reason instanceof Error ? clinicsResult.reason.message : 'Failed to load subscribed clinics', 'info');
    }

    setLoadingPlanDetails(false);
  };

  const visiblePlanClinics = planClinics.filter(clinic =>
    `${clinic.name} ${clinic.owner} ${clinic.email}`.toLowerCase().includes(clinicSearch.toLowerCase())
      && (planClinicStatusFilter === 'All' || clinic.status.toLowerCase() === planClinicStatusFilter.toLowerCase()),
  );
  const planClinicStatuses = ['All', ...Array.from(new Set(planClinics.map(clinic => clinic.status)))];
  const planClinicPageSize = 6;
  const planClinicPageCount = Math.max(1, Math.ceil(visiblePlanClinics.length / planClinicPageSize));
  const currentPlanClinicPage = Math.min(planClinicPage, planClinicPageCount);
  const pagePlanClinics = visiblePlanClinics.slice((currentPlanClinicPage - 1) * planClinicPageSize, currentPlanClinicPage * planClinicPageSize);
  const planClinicStatusStyle = (status: string) => status.toLowerCase() === 'active'
    ? 'bg-[#dff8ed] text-[#087a59]'
    : status.toLowerCase() === 'expired' || status.toLowerCase() === 'rejected' || status.toLowerCase() === 'suspended'
      ? 'bg-[#fff1c9] text-[#b77900]'
      : 'bg-[#eaf2f8] text-[#536b80]';

  const saveNewPlan = () => {
    if (!createForm.name.trim() || !createForm.description.trim()) {
      showNotice('Please enter a plan name and description.', 'info');
      return;
    }
    apiFetch('/api/subscription-plans', { method: 'POST', body: JSON.stringify({ ...createForm, name: createForm.name.trim(), description: createForm.description.trim() }) })
      .then(async response => { if (!response.ok) throw new Error('Failed to create plan'); return response.json(); })
      .then(item => {
        setPlans(current => [...current, {
          ...createForm,
          id: item.id,
          name: createForm.name.trim(),
          description: createForm.description.trim(),
          staffLimit: Number(item.staff_limit) === 0 ? 'Unlimited' : String(item.staff_limit ?? createForm.staffLimit),
          subscribedClinics: Number(item.subscribed_clinics) || 0,
        }]);
        setCreatingPlan(false);
        showNotice(`${createForm.name.trim()} plan created.`, 'success');
      }).catch(error => showNotice(error instanceof Error ? error.message : 'Failed to create plan', 'info'));
  };

  const savePlan = () => {
    if (!editForm) return;
    if (!editForm.id) return;
    apiFetch(`/api/subscription-plans/${editForm.id}`, { method: 'PUT', body: JSON.stringify(editForm) })
      .then(async response => { if (!response.ok) throw new Error('Failed to update plan'); })
      .then(() => {
        setPlans(current => current.map(plan => plan.id === editForm.id ? editForm : plan));
        setEditingPlan(null);
        setEditForm(null);
        showNotice(`${editForm.name} plan updated.`, 'success');
      }).catch(error => showNotice(error instanceof Error ? error.message : 'Failed to update plan', 'info'));
  };

  const togglePlan = (plan: Plan) => {
    const active = !plan.active;
    if (!plan.id) return;
    apiFetch(`/api/subscription-plans/${plan.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: active ? 'active' : 'inactive' }) })
      .then(async response => { if (!response.ok) throw new Error('Failed to update plan status'); })
      .then(() => {
        setPlans(current => current.map(item => item.id === plan.id ? { ...item, active } : item));
        showNotice(`${plan.name} plan ${active ? 'activated' : 'deactivated'}.`, active ? 'success' : 'info');
      }).catch(error => showNotice(error instanceof Error ? error.message : 'Failed to update plan status', 'info'));
  };

  return (
    <div className={`${shell} text-sm`}>
      <div className="flex items-center justify-between">
        <button onClick={openCreatePlan} className="rounded-full bg-[#086b50] px-4 py-2 text-sm font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" />Create Plan</button>
      </div>
      {notice && (
        <div className={`fixed right-6 top-6 z-[100] flex items-center gap-3 rounded-xl border px-5 py-3 text-sm shadow-lg ${
          notice.kind === 'success' ? 'border-[#7ce3af] bg-[#f0fff6]' : 'border-[#82b5ff] bg-[#f0f7ff]'
        }`}>
          <span className={`text-lg ${notice.kind === 'success' ? 'text-[#079669]' : 'text-[#086b50]'}`}>{notice.kind === 'success' ? '✓' : 'ⓘ'}</span>
          {notice.message}
        </div>
      )}
      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[28.5%]" />
              <col className="w-[17%]" />
              <col className="w-[14%]" />
              <col className="w-[15.5%]" />
              <col className="w-[12.5%]" />
              <col className="w-[12.5%]" />
            </colgroup>
            <thead className="bg-gradient-to-r from-[#013826] to-[#086b50] text-white">
              <tr>
                {['Plan Name', 'Price', 'Billing Cycle', 'Subscribed Clinics', 'Status', ''].map(heading => (
                  <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold" key={heading}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => {
                return (
                  <Fragment key={plan.id || plan.name}>
                    <tr className="border-b border-[#e2eee7] bg-white transition-colors hover:bg-[#fbfdfb]">
                      <td className="px-4 py-3">
                        <div className="min-w-[220px]">
                          <h2 className="truncate text-sm font-semibold text-[#172b24]">{plan.name}</h2>
                          <p className="mt-1 truncate text-xs text-[#526B62]">{plan.description}</p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="text-sm font-semibold text-[#172b24]">{formatPrice(plan.price)} <span className="font-normal">/ month</span></p>
                        <p className="mt-1 text-sm text-[#526B62]">{formatPrice(plan.annualPrice)} <span>/ year</span></p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="whitespace-nowrap text-sm text-[#172b24]">{plan.staffLimit.toLowerCase() === 'unlimited' || plan.staffLimit === '0' ? 'Unlimited staff' : plan.staffLimit ? `Up to ${plan.staffLimit} staff` : 'Staff limit not set'}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="text-sm font-semibold text-[#172b24]">{plan.subscribedClinics}</p>
                        <p className="mt-1 text-xs text-[#526B62]">Subscribed Clinics</p>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => togglePlan(plan)} title={`Click to ${plan.active ? 'deactivate' : 'activate'} ${plan.name}`} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${plan.active ? 'bg-[#dff8ed] text-[#087a59]' : 'bg-[#eef2f6] text-[#536b80]'}`}>
                          <span className={`h-2.5 w-2.5 rounded-full ${plan.active ? 'bg-[#0db966]' : 'bg-[#8da2b5]'}`} />
                          {plan.active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openPlanDetails(plan)} aria-label={`View ${plan.name} plan`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#086b50] transition-colors hover:bg-[#e7f4ec] hover:text-[#013826] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#078c63]">
                            <ChevronRight className="h-4 w-4" />
                          </button>
                          <button onClick={() => openEditPlan(plan)} aria-label={`Edit ${plan.name} plan`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#087a59] transition-colors hover:bg-[#e7f4ec] hover:text-[#013826] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#078c63]">
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
              {plans.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#789087]">No subscription plans found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {viewingPlan && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#152744]/60 p-4">
          <div className="flex h-[min(560px,calc(100vh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-gradient-to-r from-[#013826] to-[#087a59] px-4 py-3 text-white">
              <h2 className="text-sm font-semibold">
                {planModalPage === 'details' ? 'View Plan Details' : planModalPage === 'subscribers' ? `${viewingPlan.name} Plan Subscribers` : `${selectedPlanClinic?.name || 'Clinic'} Details`}
              </h2>
              <button onClick={() => { setViewingPlan(null); setSelectedPlanClinic(null); setPlanModalPage('details'); }} aria-label="Close plan details" className="text-xl leading-none">×</button>
            </div>
            {planModalPage === 'details' && (
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div><h3 className="text-base font-semibold text-[#172b24]">{viewingPlan.name}</h3><p className="mt-0.5 text-xs text-[#526B62]">{viewingPlan.description}</p></div>
                </div>
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${viewingPlan.active ? 'bg-[#dff8ed] text-[#087a59]' : 'bg-[#eef2f6] text-[#536b80]'}`}>
                  <span className={`h-2 w-2 rounded-full ${viewingPlan.active ? 'bg-[#0db966]' : 'bg-[#8da2b5]'}`} />
                  {viewingPlan.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 border-y border-[#e2eee7] py-3 sm:grid-cols-4">
                <div className="border-r border-[#e2eee7] px-2 py-1">
                  <p className="text-[11px] font-semibold text-[#172b24]">Pricing</p>
                  <p className="mt-1 text-[11px] text-[#526B62]">{formatPrice(viewingPlan.price)} / month</p>
                  <p className="text-[11px] text-[#526B62]">{formatPrice(viewingPlan.annualPrice)} / year</p>
                </div>
                <div className="border-r border-[#e2eee7] px-2 py-1 sm:px-4">
                  <p className="text-[11px] font-semibold text-[#172b24]">Billing Cycle</p>
                  <p className="mt-1 text-[11px] text-[#526B62]">Monthly</p>
                </div>
                <div className="border-r border-[#e2eee7] px-2 py-1 sm:px-4">
                  <p className="text-[11px] font-semibold text-[#172b24]">Staff Limit</p>
                  <p className="mt-1 text-[11px] text-[#526B62]">{viewingPlan.staffLimit === 'Unlimited' || viewingPlan.staffLimit === '0' ? 'Unlimited staff' : `Up to ${viewingPlan.staffLimit} staff`}</p>
                </div>
                <div className="px-2 py-1 sm:px-4">
                  <p className="text-[11px] font-semibold text-[#172b24]">User Limit</p>
                  <p className="mt-1 text-[11px] text-[#526B62]">Not set</p>
                </div>
              </div>

              <div className="mt-3 flex border-b border-[#d4e9df]">
                {([
                  ['overview', 'Overview'],
                  ['clinics', `Subscribed Clinics (${loadingPlanDetails ? viewingPlan.subscribedClinics : planClinics.length})`],
                ] as const).map(([tab, label]) => (
                  <button key={tab} onClick={() => setPlanDetailTab(tab)} className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[11px] font-medium transition ${planDetailTab === tab ? 'border-[#087a59] text-[#087a59]' : 'border-transparent text-[#647b71] hover:text-[#087a59]'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {planDetailTab === 'overview' && (
                <div className="space-y-4 py-4">
                  <div className="rounded-lg border border-[#e2eee7] bg-[#f7fbf8] p-4">
                    <h4 className="text-xs font-semibold text-[#172b24]">Plan Overview</h4>
                    <p className="mt-2 text-xs leading-5 text-[#526B62]">{viewingPlan.description || 'No plan description provided.'}</p>
                  </div>
                  <div className="rounded-lg border border-[#e2eee7] p-4">
                    <h4 className="text-xs font-semibold text-[#172b24]">Included Features</h4>
                    {viewingPlan.features.length
                      ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">{viewingPlan.features.map((feature, index) => <li className="text-xs text-[#526B62]" key={`${planFeatureName(feature)}-${index}`}><Check className="mr-2 inline h-3.5 w-3.5 text-[#078c63]" />{planFeatureName(feature)}</li>)}</ul>
                      : <p className="mt-2 text-xs text-[#789087]">No features listed.</p>}
                  </div>
                </div>
              )}

              {planDetailTab === 'clinics' && (
                <div className="py-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="relative w-full max-w-sm">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#789087]" />
                      <input value={clinicSearch} onChange={event => setClinicSearch(event.target.value)} className="w-full rounded-full border border-[#d4e3d7] bg-[#fbfdfb] py-2 pl-9 pr-3 text-xs text-[#172b24] placeholder:text-[#789087] outline-none transition focus:border-[#087a59] focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(8,122,89,0.16)]" placeholder="Search clinics..." />
                    </div>
                    <button onClick={() => {
                      setPlanClinicStatusFilter('All');
                      setClinicSearch('');
                      setPlanClinicPage(1);
                      setPlanModalPage('subscribers');
                    }} className="inline-flex items-center gap-1.5 rounded-full border border-[#087a59] px-3 py-2 text-xs font-semibold text-[#087a59] hover:bg-[#f2f8f4]"><ChevronRight className="h-3.5 w-3.5" />View All</button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-[#e2eee7]">
                    <table className="w-full min-w-[560px] text-left text-xs">
                      <thead className="bg-gradient-to-r from-[#013826] to-[#087a59] text-white"><tr>{['Clinic Name', 'Owner', 'Subscription Date', 'Status'].map(label => <th className="px-3 py-2 font-semibold" key={label}>{label}</th>)}</tr></thead>
                      <tbody>
                        {loadingPlanDetails && <tr><td colSpan={4} className="px-3 py-6 text-center text-[#789087]">Loading subscribed clinics...</td></tr>}
                        {!loadingPlanDetails && visiblePlanClinics.map(clinic => (
                          <tr className="border-t border-[#e2eee7]" key={clinic.id}>
                            <td className="px-3 py-2.5 font-medium text-[#172b24]">{clinic.name}</td>
                            <td className="px-3 py-2.5 text-[#526B62]">{clinic.owner}</td>
                            <td className="px-3 py-2.5 text-[#526B62]">{clinic.subscriptionDate}</td>
                            <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#dff8ed] px-2.5 py-1 font-medium text-[#087a59]"><span className="h-1.5 w-1.5 rounded-full bg-[#0db966]" />{clinic.status}</span></td>
                          </tr>
                        ))}
                        {!loadingPlanDetails && visiblePlanClinics.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-[#789087]">{clinicSearch ? 'No clinics match your search.' : 'No clinics are assigned to this plan.'}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end border-t border-[#e2eee7] pt-3">
                <button onClick={() => setViewingPlan(null)} className="rounded-full border border-[#b7dcca] bg-white px-4 py-2 text-xs font-semibold text-[#086b50]">Close</button>
              </div>
            </div>
            )}
            {planModalPage === 'subscribers' && (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
                <button onClick={() => setPlanModalPage('details')} className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-[#087a59] transition hover:text-[#013826]">
                  <ArrowLeft className="h-4 w-4" />Back to Plan Details
                </button>
                <section className={`${card} flex min-h-0 flex-1 flex-col overflow-hidden p-2`}>
                  <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
                    <div className="relative w-full max-w-sm">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#789087]" />
                      <input value={clinicSearch} onChange={event => { setClinicSearch(event.target.value); setPlanClinicPage(1); }} className="w-full rounded-full border border-[#d4e3d7] bg-[#fbfdfb] py-2 pl-9 pr-3 text-xs text-[#172b24] placeholder:text-[#789087] outline-none transition focus:border-[#087a59] focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(8,122,89,0.16)]" placeholder="Search clinics..." />
                    </div>
                    <div className="relative" ref={planClinicStatusRef}>
                      <button type="button" aria-haspopup="listbox" aria-expanded={planClinicStatusOpen} onClick={() => setPlanClinicStatusOpen(open => !open)} onKeyDown={event => { if (event.key === 'Escape') setPlanClinicStatusOpen(false); }} className="inline-flex items-center gap-2 rounded-full border border-[#d4e3d7] bg-white px-3 py-2 text-xs text-[#40594f] transition hover:border-[#b7dcca] hover:bg-[#f7fbf8] focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(8,122,89,0.16)]">
                        <span className="font-medium text-[#526B62]">Status:</span>
                        <span className="font-semibold text-[#172b24]">{planClinicStatusFilter}</span>
                        <ChevronDown className={`h-3.5 w-3.5 text-[#789087] transition-transform ${planClinicStatusOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {planClinicStatusOpen && (
                        <div role="listbox" aria-label="Filter clinics by status" className="absolute right-0 top-full z-30 mt-2 min-w-full overflow-hidden rounded-xl border border-[#d4e3d7] bg-white p-1 shadow-lg">
                          {planClinicStatuses.map(status => (
                            <button key={status} type="button" role="option" aria-selected={planClinicStatusFilter === status} onClick={() => { setPlanClinicStatusFilter(status); setPlanClinicPage(1); setPlanClinicStatusOpen(false); }} className={`block w-full rounded-lg px-3 py-2 text-left text-xs transition ${planClinicStatusFilter === status ? 'bg-[#e7f4ec] font-semibold text-[#07543d]' : 'text-[#40594f] hover:bg-[#f2f8f4]'}`}>
                              {status}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[#d4e9df]">
                    <table className="w-full min-w-[720px] table-fixed text-left text-xs">
                      <thead className="bg-gradient-to-r from-[#013826] to-[#087a59] text-white">
                        <tr>{['Clinic Name', 'Owner', 'Email', 'Subscription Date', 'Expiration Date', 'Status', ''].map((column, index) => <th className="px-2 py-2.5 font-semibold" key={column || `subscriber-action-${index}`}>{column}</th>)}</tr>
                      </thead>
                      <tbody>
                        {loadingPlanDetails && <tr><td colSpan={7} className="px-3 py-6 text-center text-[#789087]">Loading subscribed clinics...</td></tr>}
                        {!loadingPlanDetails && pagePlanClinics.map(clinic => (
                          <tr className="h-12 border-t border-[#e2eee7] hover:bg-[#f7fbf8]" key={clinic.id}>
                            <td className="truncate px-3 py-2.5 font-medium text-[#172b24]" title={clinic.name}>{clinic.name}</td>
                            <td className="truncate px-3 py-2.5 text-[#526B62]" title={clinic.owner}>{clinic.owner}</td>
                            <td className="truncate px-3 py-2.5 text-[#526B62]" title={clinic.email}>{clinic.email}</td>
                            <td className="truncate px-3 py-2.5 text-[#526B62]">{clinic.subscriptionDate}</td>
                            <td className="truncate px-3 py-2.5 text-[#526B62]">{clinic.expirationDate}</td>
                            <td className="px-3 py-2.5"><span className={`inline-flex rounded-full px-2.5 py-1 font-medium ${planClinicStatusStyle(clinic.status)}`}>{clinic.status}</span></td>
                            <td className="px-3 py-2"><button onClick={() => { setSelectedPlanClinic(clinic); setPlanModalPage('clinic-details'); }} aria-label={`View ${clinic.name} details`} title="View details" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#087a59] transition-colors hover:bg-[#e7f4ec] hover:text-[#013826] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#078c63]"><ChevronRight className="h-4 w-4" /></button></td>
                          </tr>
                        ))}
                        {!loadingPlanDetails && pagePlanClinics.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-[#789087]">{clinicSearch || planClinicStatusFilter !== 'All' ? 'No clinics match these filters.' : 'No clinics are assigned to this plan.'}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 text-[11px] text-[#40594f]">
                    <p>Showing {visiblePlanClinics.length ? (currentPlanClinicPage - 1) * planClinicPageSize + 1 : 0}–{Math.min(currentPlanClinicPage * planClinicPageSize, visiblePlanClinics.length)} of {visiblePlanClinics.length} clinics</p>
                    <div className="flex items-center gap-1">
                      <button disabled={currentPlanClinicPage === 1} onClick={() => setPlanClinicPage(currentPlanClinicPage - 1)} className="rounded-md border border-[#d4e3d7] px-2 py-1 disabled:opacity-40">‹</button>
                      {Array.from({ length: planClinicPageCount }, (_, index) => index + 1).map(pageNumber => (
                        <button key={pageNumber} onClick={() => setPlanClinicPage(pageNumber)} className={`min-w-7 rounded-md border px-2 py-1 ${currentPlanClinicPage === pageNumber ? 'border-[#087a59] bg-[#087a59] text-white' : 'border-[#d4e3d7] bg-white text-[#40594f]'}`}>{pageNumber}</button>
                      ))}
                      <button disabled={currentPlanClinicPage === planClinicPageCount} onClick={() => setPlanClinicPage(currentPlanClinicPage + 1)} className="rounded-md border border-[#d4e3d7] px-2 py-1 disabled:opacity-40">›</button>
                    </div>
                  </div>
                </section>
              </div>
            )}
            {planModalPage === 'clinic-details' && selectedPlanClinic && (
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <button onClick={() => { setSelectedPlanClinic(null); setPlanModalPage('subscribers'); }} className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-[#087a59] transition hover:text-[#013826]">
                  Back to subscribers
                </button>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d4e9df] bg-gradient-to-br from-white via-[#f5fbf7] to-[#e8f6ee] p-4">
                  <div>
                    <h3 className="text-base font-bold text-[#172b24]">{selectedPlanClinic.name}</h3>
                    <p className="mt-1 text-xs text-[#526B62]">Clinic subscription details</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${planClinicStatusStyle(selectedPlanClinic.status)}`}>
                    <span className="h-2 w-2 rounded-full bg-current" />{selectedPlanClinic.status}
                  </span>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <section className="rounded-xl border border-[#d4e9df] p-4">
                    <h3 className="border-b border-[#e2eee7] pb-2 text-sm font-bold text-[#172b24]">Clinic Details</h3>
                    <dl className="mt-3 space-y-3 text-xs">
                      <div className="grid grid-cols-[76px_minmax(0,1fr)] items-start gap-2"><dt className="text-[#526B62]">Owner</dt><dd className="break-words font-medium text-[#172b24]">{selectedPlanClinic.owner}</dd></div>
                      <div className="grid grid-cols-[76px_minmax(0,1fr)] items-start gap-2"><dt className="text-[#526B62]">Email</dt><dd className="break-all font-medium text-[#172b24]">{selectedPlanClinic.email}</dd></div>
                      <div className="grid grid-cols-[76px_minmax(0,1fr)] items-start gap-2"><dt className="text-[#526B62]">Phone</dt><dd className="break-words font-medium text-[#172b24]">{selectedPlanClinic.phone}</dd></div>
                      <div className="grid grid-cols-[76px_minmax(0,1fr)] items-start gap-2"><dt className="text-[#526B62]">Address</dt><dd className="break-words font-medium text-[#172b24]">{selectedPlanClinic.address}</dd></div>
                    </dl>
                  </section>
                  <section className="rounded-xl border border-[#d4e9df] p-4">
                    <h3 className="border-b border-[#e2eee7] pb-2 text-sm font-bold text-[#172b24]">Subscription Information</h3>
                    <dl className="mt-3 space-y-3 rounded-xl bg-[#eaf7f0] p-4 text-xs">
                      <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-2"><dt className="text-[#526B62]">Plan</dt><dd className="font-semibold text-[#172b24]">{viewingPlan.name}</dd></div>
                      <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-2"><dt className="text-[#526B62]">Subscribed</dt><dd className="font-semibold text-[#172b24]">{selectedPlanClinic.subscriptionDate}</dd></div>
                      <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-2"><dt className="text-[#526B62]">Expires</dt><dd className="font-semibold text-[#172b24]">{selectedPlanClinic.expirationDate}</dd></div>
                      <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-2"><dt className="text-[#526B62]">Billing Cycle</dt><dd className="font-semibold capitalize text-[#172b24]">Monthly</dd></div>
                    </dl>
                  </section>
                </div>
                <section className="mt-4 rounded-xl border border-[#d4e9df] p-4">
                  <h3 className="border-b border-[#e2eee7] pb-2 text-sm font-bold text-[#172b24]">Plan Features</h3>
                  {viewingPlan.features.length ? (
                    <ul className="mt-3 grid gap-2 text-xs text-[#40594f] sm:grid-cols-2">
                      {[
                        viewingPlan.staffLimit === 'Unlimited' ? 'Unlimited staff members' : `Up to ${viewingPlan.staffLimit} staff members`,
                        ...viewingPlan.features.map(planFeatureName),
                      ].map((feature, index) => (
                        <li className="rounded-lg bg-[#f0f8f3] px-3 py-2" key={`${feature}-${index}`}>{feature}</li>
                      ))}
                    </ul>
                  ) : <p className="mt-3 text-xs text-[#789087]">No plan features listed.</p>}
                </section>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
      {creatingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#152744]/60 p-4">
          <div className="w-full max-w-[512px] rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#d4e3d7] px-6 py-5">
              <h2 className="text-lg font-bold">Create New Plan</h2>
              <button onClick={() => setCreatingPlan(false)} className="text-2xl text-[#4870ba]">×</button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <label className="block text-sm text-[#086b50]">Plan Name
                <input value={createForm.name} onChange={event => setCreateForm({ ...createForm, name: event.target.value })} className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-base text-[#172b24] outline-none focus:ring-2 focus:ring-[#8eb5ff]" />
              </label>
              <label className="block text-sm text-[#086b50]">Description
                <input value={createForm.description} onChange={event => setCreateForm({ ...createForm, description: event.target.value })} className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-base text-[#172b24] outline-none focus:ring-2 focus:ring-[#8eb5ff]" />
              </label>
              <label className="block text-sm text-[#086b50]">Price
                <input value={createForm.price} onChange={event => setCreateForm({ ...createForm, price: event.target.value })} placeholder="Monthly price" className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-base text-[#172b24] outline-none focus:ring-2 focus:ring-[#8eb5ff]" />
              </label>
              <label className="block text-sm text-[#086b50]">Annual Price
                <input value={createForm.annualPrice} onChange={event => setCreateForm({ ...createForm, annualPrice: event.target.value })} placeholder="Annual price" className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-base text-[#172b24] outline-none focus:ring-2 focus:ring-[#8eb5ff]" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="text-sm text-[#086b50]">Billing Cycle
                  <select className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-base text-[#172b24]"><option>Monthly</option><option>Yearly</option></select>
                </label>
                <label className="text-sm text-[#086b50]">Staff Limit
                  <input value={createForm.staffLimit} onChange={event => setCreateForm({ ...createForm, staffLimit: event.target.value })} className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-base text-[#172b24]" />
                </label>
              </div>
              <label className="block text-sm text-[#086b50]">Features
                <div className="mt-1 flex gap-2">
                  <input value={newFeature} onChange={event => setNewFeature(event.target.value)} placeholder="Add a feature..." className="min-w-0 flex-1 rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-base text-[#172b24]" />
                  <button onClick={() => { if (newFeature.trim()) { setCreateForm({ ...createForm, features: [...createForm.features, newFeature.trim()] }); setNewFeature(''); } }} className="rounded-lg bg-[#086b50] px-4 text-sm font-semibold text-white">Add</button>
                </div>
              </label>
              {createForm.features.length > 0 && (
                <ul className="space-y-1.5">{createForm.features.map((feature, index) => <li className="flex items-center justify-between rounded-lg bg-[#eef4ff] px-3 py-2 text-sm text-[#526B62]" key={`${planFeatureName(feature)}-${index}`}>{planFeatureName(feature)}<button onClick={() => setCreateForm({ ...createForm, features: createForm.features.filter((_, itemIndex) => itemIndex !== index) })} className="text-sm text-[#e52d2d]">Remove</button></li>)}</ul>
              )}
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button onClick={saveNewPlan} className="rounded-lg bg-[#086b50] px-4 py-3 text-sm font-semibold text-white">Save Plan</button>
              <button onClick={() => setCreatingPlan(false)} className="rounded-lg bg-[#e7f4ec] px-4 py-3 text-sm text-[#086b50]">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {editingPlan && editForm && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-[min(560px,calc(100vh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-[#013826] to-[#087a59] px-6 py-4 text-white">
              <h2 className="text-base font-semibold">Edit — {editingPlan.name}</h2>
              <button onClick={() => { setEditingPlan(null); setEditForm(null); }} aria-label="Close edit plan" className="text-2xl leading-none text-white transition hover:text-[#d4e9df]">×</button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-5 py-4 sm:px-6">
              {addingEditFeature ? (
                <>
                  <button onClick={() => { setNewFeature(''); setNewFeatureDescription(''); setAddingEditFeature(false); }} className="inline-flex items-center gap-2 py-1 text-sm font-semibold text-[#087a59] transition hover:text-[#013826]">
                    <ArrowLeft className="h-4 w-4" />Back
                  </button>
                  <section className="overflow-hidden rounded-xl border border-[#d4e9df]">
                    <h3 className="bg-gradient-to-r from-[#e7f4ec] to-[#dff4e9] px-4 py-3 text-lg font-bold text-[#07543d]">Add Feature</h3>
                    <div className="space-y-4 p-4 sm:p-5">
                      <label className="block text-sm font-semibold text-[#173c2e]">Feature Name <span className="text-red-600">*</span>
                        <input autoFocus required value={newFeature} onChange={event => setNewFeature(event.target.value)} placeholder="Enter feature name..." className="mt-1 w-full rounded-xl border border-[#d4e3d7] bg-white px-4 py-3 text-sm text-[#172b24] outline-none transition placeholder:text-[#789087] focus:border-[#087a59] focus:ring-0 focus:shadow-[0_0_0_3px_rgba(8,122,89,0.18)]" />
                      </label>
                      <label className="block text-sm font-semibold text-[#173c2e]">Description <span className="font-normal text-[#526B62]">(Optional)</span>
                        <textarea value={newFeatureDescription} onChange={event => setNewFeatureDescription(event.target.value)} placeholder="Enter feature description..." rows={3} className="mt-1 w-full resize-y rounded-xl border border-[#d4e3d7] bg-white px-4 py-3 text-sm text-[#172b24] outline-none transition placeholder:text-[#789087] focus:border-[#087a59] focus:ring-0 focus:shadow-[0_0_0_3px_rgba(8,122,89,0.18)]" />
                      </label>
                      <fieldset>
                        <legend className="mb-2 text-sm font-semibold text-[#173c2e]">Feature Type</legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {([
                            ['included', 'Included Feature'],
                            ['addon', 'Add-on Feature'],
                          ] as const).map(([type, label]) => (
                            <label key={type} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition ${newFeatureType === type ? 'border-[#b7dcca] bg-[#e7f4ec] text-[#07543d]' : 'border-[#d4e3d7] bg-white text-[#40594f] hover:bg-[#f7fbf8]'}`}>
                              <input type="radio" name="plan-feature-type" value={type} checked={newFeatureType === type} onChange={() => setNewFeatureType(type)} className="peer sr-only" />
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#aabbb2] bg-white transition peer-focus-visible:ring-2 peer-focus-visible:ring-[#087a59]/30">
                                {newFeatureType === type && <span className="h-2.5 w-2.5 rounded-full bg-[#087a59]" />}
                              </span>
                              {label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </div>
                  </section>
                </>
              ) : (
                <>
              <section className="overflow-hidden rounded-xl border border-[#d4e9df]">
                <h3 className="bg-gradient-to-r from-[#e7f4ec] to-[#dff4e9] px-4 py-2 text-sm font-semibold text-[#07543d]">Plan Details</h3>
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                  {[
                    ['Plan Name', 'name'],
                    ['Description', 'description'],
                    ['Monthly Price', 'price'],
                    ['Annual Price', 'annualPrice'],
                  ].map(([label, key]) => (
                    <label className="block text-xs font-medium text-[#173c2e]" key={key}>{label}
                      <input value={editForm[key as keyof Plan] as string} onChange={event => setEditForm({ ...editForm, [key]: event.target.value })} className="mt-1 w-full rounded-lg border border-[#d4e3d7] bg-white px-3 py-2 text-sm text-[#172b24] outline-none transition focus:border-[#087a59] focus:ring-2 focus:ring-[#087a59]/15" />
                    </label>
                  ))}
                  <label className="block text-xs font-medium text-[#173c2e]">Billing Cycle
                    <select className="mt-1 w-full rounded-lg border border-[#d4e3d7] bg-white px-3 py-2 text-sm text-[#172b24] outline-none focus:border-[#087a59] focus:ring-2 focus:ring-[#087a59]/15"><option>Monthly</option><option>Yearly</option></select>
                  </label>
                  <label className="block text-xs font-medium text-[#173c2e]">Staff Limit
                    <input value={editForm.staffLimit} onChange={event => setEditForm({ ...editForm, staffLimit: event.target.value })} className="mt-1 w-full rounded-lg border border-[#d4e3d7] bg-white px-3 py-2 text-sm text-[#172b24] outline-none transition focus:border-[#087a59] focus:ring-2 focus:ring-[#087a59]/15" />
                  </label>
                </div>
              </section>
              <section className="overflow-hidden rounded-xl border border-[#d4e9df]">
                <h3 className="bg-gradient-to-r from-[#e7f4ec] to-[#dff4e9] px-4 py-2 text-sm font-semibold text-[#07543d]">Plan Features</h3>
                <div className="space-y-2 p-4">
                  <ul className="space-y-1.5">{editForm.features.map((feature, index) => (
                    <li className="flex items-center justify-between gap-3 rounded-lg bg-gradient-to-r from-[#f0f8f3] to-[#e9f4ed] px-3 py-2 text-sm text-[#40594f]" key={`${planFeatureName(feature)}-${index}`}>
                      <div className="min-w-0">
                        <p>{planFeatureName(feature)}</p>
                        {typeof feature !== 'string' && feature.description && <p className="mt-0.5 text-xs text-[#789087]">{feature.description}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {typeof feature !== 'string' && <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-medium text-[#087a59]">{feature.type === 'addon' ? 'Add-on' : 'Included'}</span>}
                        <button onClick={() => setEditForm({ ...editForm, features: editForm.features.filter((_, itemIndex) => itemIndex !== index) })} className="rounded-full bg-[#fde8e7] px-3 py-1 text-xs font-medium text-[#c43636] transition hover:bg-[#fbd6d4]">Remove</button>
                      </div>
                    </li>
                  ))}</ul>
                  <button onClick={() => { setNewFeature(''); setNewFeatureDescription(''); setNewFeatureType(''); setAddingEditFeature(true); }} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#087a59] bg-white px-4 py-2 text-sm font-semibold text-[#087a59] transition hover:bg-[#eff9f3]"><Plus className="h-4 w-4" />Add Feature</button>
                </div>
              </section>
                </>
              )}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-[#e2eee7] bg-white px-5 py-3 sm:px-6">
              {addingEditFeature ? (
                <>
                  <button onClick={() => { setNewFeature(''); setNewFeatureDescription(''); setAddingEditFeature(false); }} className="rounded-full border border-[#087a59] bg-white px-4 py-2 text-sm font-semibold text-[#087a59] transition hover:bg-[#eff9f3]">Cancel</button>
                  <button onClick={() => {
                    if (!newFeature.trim()) {
                      showNotice('Please enter a feature name.', 'info');
                      return;
                    }
                    const featureType = newFeatureType;
                    if (!featureType) {
                      showNotice('Please choose a feature type.', 'info');
                      return;
                    }
                    setEditForm({
                      ...editForm,
                      features: [...editForm.features, {
                        name: newFeature.trim(),
                        ...(newFeatureDescription.trim() ? { description: newFeatureDescription.trim() } : {}),
                        type: featureType,
                      }],
                    });
                    setNewFeature('');
                    setNewFeatureDescription('');
                    setNewFeatureType('');
                    setAddingEditFeature(false);
                  }} className="rounded-full bg-[#086b50] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#013826]">Add Feature</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditingPlan(null); setEditForm(null); }} className="rounded-full border border-[#087a59] bg-white px-4 py-2 text-sm font-semibold text-[#087a59] transition hover:bg-[#eff9f3]">Cancel</button>
                  <button onClick={savePlan} className="rounded-full bg-[#086b50] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#013826]">Save Changes</button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export function PlanSubscribers() {
  type Subscriber = {
    id: number;
    name: string;
    owner: string;
    email: string;
    phone: string;
    address: string;
    subscriptionDate: string;
    expirationDate: string;
    status: string;
  };
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<{ id: number; name: string; description: string; price: string; annualPrice: string; staffLimit: string; features: PlanFeature[] } | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pageSize = 5;

  useEffect(() => {
    if (!planId) {
      setError('Subscription plan was not found.');
      setLoading(false);
      return;
    }

    Promise.all([
      apiFetch('/api/subscription-plans').then(async response => {
        if (!response.ok) throw new Error('Failed to load subscription plans');
        return response.json();
      }),
      apiFetch('/api/clinics').then(async response => {
        if (!response.ok) throw new Error('Failed to load clinics');
        return response.json();
      }),
    ]).then(([planRows, clinicRows]) => {
      const selectedPlan = planRows.find((item: any) => String(item.id) === planId);
      if (!selectedPlan) throw new Error('Subscription plan was not found.');
      setPlan({
        id: Number(selectedPlan.id),
        name: selectedPlan.name,
        description: selectedPlan.description || '',
        price: String(selectedPlan.price || ''),
        annualPrice: String(selectedPlan.annual_price || ''),
        staffLimit: Number(selectedPlan.staff_limit) === 0 ? 'Unlimited' : String(selectedPlan.staff_limit ?? 'Not set'),
        features: Array.isArray(selectedPlan.features) ? selectedPlan.features : [],
      });

      const planSubscribers = clinicRows
        .filter((clinic: any) => {
          const assignedPlan = clinic.metadata?.application?.plan || clinic.metadata?.plan || '';
          return String(assignedPlan).trim().toLowerCase() === String(selectedPlan.name).trim().toLowerCase();
        })
        .map((clinic: any) => {
          const rawExpiry = clinic.metadata?.subscriptionExpiry || clinic.metadata?.subscription_expiry || '';
          const expiry = rawExpiry ? new Date(rawExpiry) : null;
          const clinicStatus = String(clinic.status || clinic.metadata?.status || 'Active');
          const status = expiry && !Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now()
            ? 'Expired'
            : clinicStatus.charAt(0).toUpperCase() + clinicStatus.slice(1).toLowerCase();
          return {
            id: Number(clinic.id),
            name: clinic.name || 'Unnamed clinic',
            owner: clinic.metadata?.application?.ownerName || clinic.owner || '—',
            email: clinic.metadata?.application?.ownerEmail || clinic.email || '—',
            phone: clinic.metadata?.application?.ownerPhone || clinic.phone || '—',
            address: clinic.address || '—',
            subscriptionDate: clinic.created_at ? new Date(clinic.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }) : '—',
            expirationDate: expiry && !Number.isNaN(expiry.getTime()) ? expiry.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }) : '—',
            status,
          };
        });
      setSubscribers(planSubscribers);
    }).catch(loadError => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load plan subscribers.');
    }).finally(() => setLoading(false));
  }, [planId]);

  const statuses = ['All', ...Array.from(new Set(subscribers.map(subscriber => subscriber.status)))];
  const filteredSubscribers = subscribers.filter(subscriber => {
    const matchesSearch = `${subscriber.name} ${subscriber.owner} ${subscriber.email}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || subscriber.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });
  const pageCount = Math.max(1, Math.ceil(filteredSubscribers.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageSubscribers = filteredSubscribers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const statusStyle = (status: string) => status.toLowerCase() === 'active'
    ? 'bg-[#dff8ed] text-[#087a59]'
    : status.toLowerCase() === 'expired' || status.toLowerCase() === 'rejected' || status.toLowerCase() === 'suspended'
      ? 'bg-[#fff1c9] text-[#b77900]'
      : 'bg-[#eaf2f8] text-[#536b80]';

  return (
    <div className={`${shell} space-y-4`}>
      <main className="min-w-0 space-y-4">
      <button onClick={() => navigate('/subscription-plans')} className="inline-flex items-center gap-2 text-sm font-semibold text-[#087a59] hover:text-[#013826]">
        <ArrowLeft className="h-4 w-4" />Back to Subscription Plans
      </button>
      {error && <div className="rounded-lg border border-[#f2c7c7] bg-[#fff8f8] px-4 py-3 text-sm text-[#a52d2d]">{error}</div>}
      {!error && loading && <div className={`${card} p-8 text-center text-sm text-[#789087]`}>Loading plan subscribers...</div>}
      {!error && !loading && plan && (
        <>
          <section className="rounded-2xl border border-[#d4e9df] bg-gradient-to-br from-white via-[#f5fbf7] to-[#e8f6ee] p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <h1 className="text-xl font-bold text-[#172b24]">{plan.name} Plan Subscribers</h1>
                <p className="mt-1 text-sm text-[#526B62]">View and manage all clinics under the {plan.name} plan.</p>
              </div>
            </div>
            <div className="mt-5 inline-flex items-center gap-3 rounded-xl border border-[#d4e9df] bg-white/80 px-4 py-3">
              <div>
                <p className="text-xs text-[#526B62]">Total {plan.name} Subscribers</p>
                <p className="text-2xl font-bold text-[#172b24]">{subscribers.length}</p>
              </div>
              <div className="ml-4 border-l border-[#d4e9df] pl-4 text-xs text-[#526B62]">
                <p>{formatSubscriberPrice(plan.price)} / month</p>
                <p className="mt-1">{formatSubscriberPrice(plan.annualPrice)} / year</p>
              </div>
            </div>
          </section>

          <section className={`${card} overflow-hidden p-4`}>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#789087]" />
                <input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className="w-full rounded-lg border border-[#d4e3d7] bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#087a59]" placeholder="Search clinics..." />
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-[#d4e3d7] px-3 py-2 text-xs text-[#40594f]">
                Status:
                <select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }} className="bg-transparent text-xs font-medium outline-none">
                  {statuses.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[#d4e9df]">
              <table className="w-full min-w-[850px] table-fixed text-left text-xs">
                <thead className="bg-gradient-to-r from-[#013826] to-[#087a59] text-white">
                  <tr>{['Clinic Name', 'Owner', 'Email', 'Subscription Date', 'Expiration Date', 'Status', ''].map((column, index) => <th className="px-3 py-2.5 font-semibold" key={column || `action-${index}`}>{column}</th>)}</tr>
                </thead>
                <tbody>
                  {pageSubscribers.map(subscriber => (
                    <tr className="h-[52px] border-t border-[#e2eee7] hover:bg-[#f7fbf8]" key={subscriber.id}>
                      <td className="truncate px-3 py-2 font-medium text-[#172b24]" title={subscriber.name}>{subscriber.name}</td>
                      <td className="truncate px-3 py-2 text-[#526B62]" title={subscriber.owner}>{subscriber.owner}</td>
                      <td className="truncate px-3 py-2 text-[#526B62]" title={subscriber.email}>{subscriber.email}</td>
                      <td className="truncate px-3 py-2 text-[#526B62]">{subscriber.subscriptionDate}</td>
                      <td className="truncate px-3 py-2 text-[#526B62]">{subscriber.expirationDate}</td>
                      <td className="px-3 py-2"><span className={`inline-flex rounded-full px-2.5 py-1 font-medium ${statusStyle(subscriber.status)}`}>{subscriber.status}</span></td>
                      <td className="px-3 py-2"><button onClick={() => setSelectedSubscriber(subscriber)} aria-label={`View ${subscriber.name} details`} title="View details" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#087a59] transition-colors hover:bg-[#e7f4ec] hover:text-[#013826] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#078c63]"><ChevronRight className="h-4 w-4" /></button></td>
                    </tr>
                  ))}
                  {Array.from({ length: pageSize - pageSubscribers.length }, (_, index) => (
                    <tr className="h-[52px] border-t border-[#e2eee7]" key={`empty-row-${index}`}>
                      <td colSpan={7} className="px-3 py-2 text-center text-xs text-[#789087]">
                        {pageSubscribers.length === 0 && index === 0 ? (loading ? 'Loading clinics...' : 'No clinics match these filters.') : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#40594f]">
              <p>Showing {filteredSubscribers.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filteredSubscribers.length)} of {filteredSubscribers.length} clinics</p>
              <div className="flex items-center gap-1">
                <button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-md border border-[#d4e3d7] px-2.5 py-1.5 disabled:opacity-40">‹</button>
                {Array.from({ length: pageCount }, (_, index) => index + 1).map(pageNumber => (
                  <button key={pageNumber} onClick={() => setPage(pageNumber)} className={`min-w-8 rounded-md border px-2.5 py-1.5 ${currentPage === pageNumber ? 'border-[#087a59] bg-[#087a59] text-white' : 'border-[#d4e3d7] bg-white text-[#40594f]'}`}>{pageNumber}</button>
                ))}
                <button disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="rounded-md border border-[#d4e3d7] px-2.5 py-1.5 disabled:opacity-40">›</button>
              </div>
            </div>
          </section>
        </>
      )}
      </main>
      {selectedSubscriber && plan && (
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#152744]/60 p-4">
            <section role="dialog" aria-modal="true" aria-labelledby="clinic-subscription-details-title" className="flex h-[min(560px,calc(100vh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-[#013826] to-[#087a59] px-5 py-4 text-white">
                <div>
                  <h2 id="clinic-subscription-details-title" className="text-base font-semibold">{selectedSubscriber.name}</h2>
                  <p className="mt-0.5 text-xs text-[#d4e9df]">Clinic Subscription Details</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyle(selectedSubscriber.status)}`}>
                    <span className="h-2 w-2 rounded-full bg-current" />{selectedSubscriber.status}
                  </span>
                  <button onClick={() => setSelectedSubscriber(null)} aria-label="Close clinic subscription details" className="text-xl leading-none transition hover:text-[#d4e9df]">×</button>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
                <button onClick={() => setSelectedSubscriber(null)} className="inline-flex items-center gap-2 py-1 text-sm font-semibold text-[#087a59] transition hover:text-[#013826]">
                  <ArrowLeft className="h-4 w-4" />Back to subscribers
                </button>
                <div className="grid gap-4 md:grid-cols-2">
                  <section className="rounded-xl border border-[#d4e9df] p-4">
                    <h3 className="border-b border-[#e2eee7] pb-2 text-sm font-bold text-[#172b24]">Clinic Details</h3>
                    <dl className="mt-3 space-y-3 text-xs">
                      <div className="grid grid-cols-[22px_76px_minmax(0,1fr)] items-start gap-2"><Users className="h-4 w-4 text-[#087a59]" /><dt className="text-[#526B62]">Owner</dt><dd className="break-words font-medium text-[#172b24]">{selectedSubscriber.owner}</dd></div>
                      <div className="grid grid-cols-[22px_76px_minmax(0,1fr)] items-start gap-2"><Mail className="h-4 w-4 text-[#087a59]" /><dt className="text-[#526B62]">Email</dt><dd className="break-all font-medium text-[#172b24]">{selectedSubscriber.email}</dd></div>
                      <div className="grid grid-cols-[22px_76px_minmax(0,1fr)] items-start gap-2"><Phone className="h-4 w-4 text-[#087a59]" /><dt className="text-[#526B62]">Phone</dt><dd className="break-words font-medium text-[#172b24]">{selectedSubscriber.phone}</dd></div>
                      <div className="grid grid-cols-[22px_76px_minmax(0,1fr)] items-start gap-2"><MapPin className="h-4 w-4 text-[#087a59]" /><dt className="text-[#526B62]">Address</dt><dd className="break-words font-medium text-[#172b24]">{selectedSubscriber.address}</dd></div>
                    </dl>
                  </section>
                  <section className="rounded-xl border border-[#d4e9df] p-4">
                    <h3 className="border-b border-[#e2eee7] pb-2 text-sm font-bold text-[#172b24]">Subscription Information</h3>
                    <dl className="mt-3 space-y-3 rounded-xl bg-[#eaf7f0] p-4 text-xs">
                      <div className="grid grid-cols-[22px_100px_minmax(0,1fr)] items-center gap-2"><CreditCard className="h-4 w-4 text-[#087a59]" /><dt className="text-[#526B62]">Plan</dt><dd className="font-semibold text-[#172b24]">{plan.name}</dd></div>
                      <div className="grid grid-cols-[22px_100px_minmax(0,1fr)] items-center gap-2"><CalendarDays className="h-4 w-4 text-[#087a59]" /><dt className="text-[#526B62]">Subscription Date</dt><dd className="font-semibold text-[#172b24]">{selectedSubscriber.subscriptionDate}</dd></div>
                      <div className="grid grid-cols-[22px_100px_minmax(0,1fr)] items-center gap-2"><CalendarDays className="h-4 w-4 text-[#087a59]" /><dt className="text-[#526B62]">Expiration Date</dt><dd className="font-semibold text-[#172b24]">{selectedSubscriber.expirationDate}</dd></div>
                      <div className="grid grid-cols-[22px_100px_minmax(0,1fr)] items-center gap-2"><CreditCard className="h-4 w-4 text-[#087a59]" /><dt className="text-[#526B62]">Billing Cycle</dt><dd className="font-semibold capitalize text-[#172b24]">Monthly</dd></div>
                    </dl>
                  </section>
                </div>
                <section className="rounded-xl border border-[#d4e9df] p-4">
                  <h3 className="border-b border-[#e2eee7] pb-2 text-sm font-bold text-[#172b24]">Plan Features</h3>
                  {plan.features.length > 0 ? (
                    <ul className="mt-3 grid gap-2 text-xs text-[#40594f] sm:grid-cols-2">
                      {[
                        plan.staffLimit === 'Unlimited' ? 'Unlimited staff members' : `Up to ${plan.staffLimit} staff members`,
                        ...plan.features.map(planFeatureName),
                      ].map((feature, index) => (
                        <li className="flex items-start gap-2 rounded-lg bg-[#f0f8f3] px-3 py-2" key={`${feature}-${index}`}><CheckCircle2 className="h-4 w-4 shrink-0 text-[#0aaa73]" />{feature}</li>
                      ))}
                    </ul>
                  ) : <p className="mt-3 text-xs text-[#789087]">No plan features listed.</p>}
                </section>
              </div>
              <div className="flex shrink-0 justify-end border-t border-[#e2eee7] px-5 py-3 sm:px-6">
                <button onClick={() => setSelectedSubscriber(null)} className="rounded-full border border-[#087a59] px-4 py-2 text-sm font-semibold text-[#087a59] transition hover:bg-[#eff9f3]">Close</button>
              </div>
            </section>
          </div>,
          document.body,
        )
      )}
    </div>
  );
}

function formatSubscriberPrice(price: string) {
  if (!price) return 'Not set';
  return /^[₱$€£]/.test(price.trim()) ? price : `₱${price}`;
}

export function DemoRequests() {
  type DemoStatus = 'New' | 'Contacted' | 'Scheduled' | 'Completed' | 'Cancelled';
  type DemoRequest = {
    id: number;
    clinic: string; contact: string; phone: string; email: string; staff: string;
    preferredDate: string; preferredTime: string; submitted: string; status: DemoStatus;
    address: string; notes: string;
  };
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [selected, setSelected] = useState<DemoRequest | null>(null);
  const [mode, setMode] = useState<'view' | 'contact' | 'schedule'>('view');
  const [notice, setNotice] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);
  const [contactNotes, setContactNotes] = useState('');
  const [scheduleForm, setScheduleForm] = useState({ date: '', time: '', representative: '', link: '', notes: '' });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusDraft, setStatusDraft] = useState<DemoStatus>('New');
  const pageSize = 5;

  const showNotice = (message: string, kind: 'success' | 'error' = 'success') => {
    setNotice({ message, kind });
    window.setTimeout(() => setNotice(null), 3500);
  };
  useEffect(() => {
    apiFetch('/api/demo-requests').then(async response => {
      if (!response.ok) throw new Error('Failed to load demo requests');
      return response.json();
    }).then(data => setRequests(data.map((item: any) => ({
      id: item.id, clinic: item.clinic || item.clinic_name || '—', contact: item.contact || item.contact_person || '—',
      phone: item.phone || '—', email: item.email || '—', staff: String(item.staff || item.staff_count || '—'),
      preferredDate: item.preferred_date || '—', preferredTime: item.preferred_time || '—',
      submitted: item.created_at ? new Date(item.created_at).toLocaleDateString() : '—',
      status: item.status || 'New', address: item.address || '—', notes: item.notes || '',
    })))).catch(error => showNotice(error instanceof Error ? error.message : 'Failed to load demo requests', 'error'));
  }, []);
  const openRequest = (request: DemoRequest) => { setSelected(request); setMode('view'); setEditingStatus(false); setStatusDraft(request.status); };
  const updateStatus = (status: DemoStatus, message: string, kind: 'success' | 'error' = 'success', closeAfterUpdate = true) => {
    if (!selected) return;
    apiFetch(`/api/demo-requests/${selected.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      .then(async response => { if (!response.ok) throw new Error('Failed to update demo request'); })
      .then(() => {
        setRequests(current => current.map(request => request.id === selected.id ? { ...request, status } : request));
        if (closeAfterUpdate) {
          setSelected(null);
        } else {
          setSelected(current => current ? { ...current, status } : current);
          setStatusDraft(status);
          setEditingStatus(false);
        }
        showNotice(message, kind);
      }).catch(error => showNotice(error instanceof Error ? error.message : 'Failed to update demo request', 'error'));
  };
  const statusGroup = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    if (['new', 'pending', 'contacted', 'under review'].includes(normalizedStatus)) return 'Pending';
    if (['scheduled', 'completed', 'approved'].includes(normalizedStatus)) return 'Approved';
    if (['cancelled', 'canceled', 'declined', 'rejected'].includes(normalizedStatus)) return 'Declined';
    return 'Pending';
  };
  const statusLabel = (status: DemoStatus) => statusGroup(status);
  const statusClass = (status: DemoStatus) => statusGroup(status) === 'Approved'
    ? 'bg-[#dff5eb] text-[#078c63]'
    : statusGroup(status) === 'Declined'
      ? 'bg-[#e9eef2] text-[#526579]'
      : 'bg-[#fff3d4] text-[#c98200]';
  const demoStatuses: DemoStatus[] = ['New', 'Contacted', 'Scheduled', 'Completed', 'Cancelled'];
  const totalPending = requests.filter(request => statusGroup(request.status) === 'Pending').length;
  const totalApproved = requests.filter(request => statusGroup(request.status) === 'Approved').length;
  const totalDeclined = requests.filter(request => statusGroup(request.status) === 'Declined').length;
  const filteredRequests = requests.filter(request => {
    const matchesSearch = `${request.clinic} ${request.contact} ${request.email}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All Statuses' || statusGroup(request.status) === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const pageCount = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRequests = filteredRequests.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className={`${shell} space-y-4`}>
      <main className="min-w-0 space-y-4">
      {notice && <div className={`fixed right-6 top-6 z-[100] flex items-center gap-3 rounded-xl border px-5 py-3 text-sm shadow-lg ${notice.kind === 'success' ? 'border-[#7ce3af] bg-[#f0fff6]' : 'border-[#ff8a8a] bg-[#fff8f8]'}`}><span className={`text-lg ${notice.kind === 'success' ? 'text-[#079669]' : 'text-[#ef3030]'}`}>{notice.kind === 'success' ? '✓' : 'ⓘ'}</span>{notice.message}</div>}
      <section className="relative isolate grid grid-cols-1 overflow-hidden rounded-xl border border-[#d4e3d7] bg-gradient-to-br from-white via-[#f7fbf8] to-[#e9f6ed] sm:grid-cols-2 xl:grid-cols-4">
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 z-0 h-[70%] w-[22%] rounded-tl-[100%] bg-[#d4efdc]" />
        {[
          { label: 'Total Requests', value: requests.length, detail: 'All demo requests' },
          { label: 'Pending', value: totalPending, detail: 'New, contacted, or under review' },
          { label: 'Approved', value: totalApproved, detail: 'Scheduled or completed' },
          { label: 'Declined', value: totalDeclined, detail: 'Cancelled or declined' },
        ].map(({ label, value, detail }, index) => (
          <div key={label} className="relative z-10 min-w-0 border-b border-[#cfe2d7] px-4 py-4 last:border-b-0 sm:px-5 xl:border-b-0">
            <p className="truncate text-sm text-[#526B62]">{label}</p>
            <p className="mt-1 text-3xl font-semibold leading-tight text-[#172b24]">{value}</p>
            <p className="mt-1 text-xs text-[#086b50]">{detail}</p>
            {index < 3 && <span aria-hidden="true" className="absolute bottom-6 right-0 top-6 hidden w-px bg-[#cfe2d7] xl:block" />}
          </div>
        ))}
      </section>
      <section className={`${card} overflow-hidden p-4`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[220px] max-w-[600px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#087a59]" />
            <input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className="w-full rounded-full border border-[#d4e3d7] bg-white py-2.5 pl-10 pr-3 text-sm text-[#172b24] outline-none transition focus:border-[#087a59] focus:ring-2 focus:ring-[#087a59]/20" placeholder="Search by clinic name or contact..." />
          </div>
          <div className="relative">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={statusMenuOpen}
              onClick={() => setStatusMenuOpen(open => !open)}
              className="inline-flex min-w-[150px] items-center justify-between gap-5 rounded-full border border-[#d4e3d7] bg-white py-2.5 pl-4 pr-3 text-sm text-[#40594f] outline-none transition hover:border-[#b7dcca] hover:bg-[#f7fbf8] focus:border-[#087a59] focus:ring-2 focus:ring-[#087a59]/20"
            >
              {statusFilter}
              <ChevronDown className={`h-4 w-4 text-[#087a59] transition-transform ${statusMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {statusMenuOpen && (
              <div role="listbox" aria-label="Filter by status" className="absolute right-0 top-full z-30 mt-1 min-w-full overflow-hidden rounded-xl border border-[#d4e3d7] bg-white p-1 shadow-lg">
                {['All Statuses', 'Pending', 'Approved', 'Declined'].map(status => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={statusFilter === status}
                    key={status}
                    onClick={() => {
                      setStatusFilter(status);
                      setPage(1);
                      setStatusMenuOpen(false);
                    }}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      statusFilter === status
                        ? 'bg-[#e7f4ec] font-medium text-[#086b50]'
                        : 'text-[#40594f] hover:bg-[#eff8f2] hover:text-[#086b50]'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#d4e3d7]">
          <table className="w-full min-w-[760px] table-fixed text-left">
            <thead className="bg-gradient-to-r from-[#013826] to-[#087a59] text-white">
              <tr>{['Clinic Name', 'Contact Person', 'Email', 'Request Date', 'Status', ''].map(heading => <th className="px-4 py-3 text-xs font-semibold" key={heading}>{heading}</th>)}</tr>
            </thead>
            <tbody>
              {pageRequests.map(request => (
                <tr
                  className="h-[50px] cursor-pointer border-t border-[#e6eee9] hover:bg-[#f0f8f3] focus-visible:bg-[#f0f8f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#078c63]"
                  key={request.id}
                  tabIndex={0}
                  aria-label={`Open demo request for ${request.clinic}`}
                  onClick={() => openRequest(request)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openRequest(request);
                    }
                  }}
                >
                  <td className="truncate px-4 py-3 text-sm font-semibold text-[#172b24]" title={request.clinic}>{request.clinic}</td>
                  <td className="truncate px-4 py-3 text-sm text-[#40594f]" title={request.contact}>{request.contact}</td>
                  <td className="truncate px-4 py-3 text-sm text-[#40594f]" title={request.email}>{request.email}</td>
                  <td className="px-4 py-3 text-sm text-[#40594f]">{request.submitted}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(request.status)}`}>{statusLabel(request.status)}</span></td>
                  <td className="px-4 py-3 text-right"><button type="button" onClick={event => { event.stopPropagation(); openRequest(request); }} aria-label={`View ${request.clinic} demo request`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#087a59] transition-colors hover:bg-[#e7f4ec] hover:text-[#013826] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#078c63]"><ChevronRight className="h-4 w-4" /></button></td>
                </tr>
              ))}
              {Array.from({ length: pageSize - pageRequests.length }, (_, index) => (
                <tr className="h-[50px] border-t border-[#e6eee9]" key={`empty-demo-row-${index}`}>
                  <td colSpan={6} className="px-4 py-3 text-center text-sm text-[#789087]">
                    {pageRequests.length === 0 && index === 0 ? (requests.length === 0 ? 'No demo requests found.' : 'No requests match these filters.') : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#40594f]">
          <p>Showing {filteredRequests.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filteredRequests.length)} of {filteredRequests.length} requests</p>
          <div className="flex items-center gap-1">
            <button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page" className="rounded-lg border border-[#d4e3d7] px-3 py-2 text-[#087a59] disabled:opacity-40">‹</button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map(pageNumber => (
              <button key={pageNumber} onClick={() => setPage(pageNumber)} className={`min-w-9 rounded-lg border px-3 py-2 ${pageNumber === currentPage ? 'border-[#087a59] bg-[#087a59] text-white' : 'border-[#d4e3d7] bg-white text-[#40594f]'}`}>{pageNumber}</button>
            ))}
            <button disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} aria-label="Next page" className="rounded-lg border border-[#d4e3d7] px-3 py-2 text-[#087a59] disabled:opacity-40">›</button>
          </div>
        </div>
      </section>
      </main>
      {selected && createPortal(
        <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black/50 p-4" onClick={event => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-request-details-title"
            className="flex h-[min(560px,calc(100vh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-[#013826] to-[#087a59] px-5 py-3 text-white">
              <h2 id="demo-request-details-title" className="text-sm font-semibold">Demo Request Details</h2>
              <button onClick={() => setSelected(null)} aria-label="Close demo request details" className="text-xl leading-none text-white transition hover:text-[#d4e9df]">×</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
              <section className="overflow-hidden rounded-xl border border-[#d4e9df] bg-white p-4">
                <h3 className="-mx-4 -mt-4 mb-3 border-b border-[#d4e9df] bg-gradient-to-r from-[#e7f4ec] to-[#dff4e9] px-4 py-2.5 text-sm font-bold text-[#07543d]">Clinic Information</h3>
                <dl className="space-y-2.5 text-xs">
                  <div className="grid grid-cols-[116px_1fr] gap-3"><dt className="text-[#526B62]">Clinic Name</dt><dd className="font-medium text-[#172b24]">{selected.clinic}</dd></div>
                  <div className="grid grid-cols-[116px_1fr] gap-3"><dt className="text-[#526B62]">Contact Person</dt><dd className="font-medium text-[#172b24]">{selected.contact}</dd></div>
                  <div className="grid grid-cols-[116px_1fr] gap-3"><dt className="text-[#526B62]">Email</dt><dd className="break-all font-medium text-[#172b24]">{selected.email}</dd></div>
                  <div className="grid grid-cols-[116px_1fr] gap-3"><dt className="text-[#526B62]">Phone Number</dt><dd className="font-medium text-[#172b24]">{selected.phone}</dd></div>
                  <div className="grid grid-cols-[116px_1fr] gap-3"><dt className="text-[#526B62]">Address</dt><dd className="font-medium text-[#172b24]">{selected.address}</dd></div>
                </dl>
              </section>
              <section className="overflow-hidden rounded-xl border border-[#d4e9df] bg-white p-4">
                <h3 className="-mx-4 -mt-4 mb-3 border-b border-[#d4e9df] bg-gradient-to-r from-[#e7f4ec] to-[#dff4e9] px-4 py-2.5 text-sm font-bold text-[#07543d]">Demo Preferences</h3>
                <dl className="space-y-2.5 text-xs">
                  <div className="grid grid-cols-[116px_1fr] gap-3"><dt className="text-[#526B62]">Preferred Date</dt><dd className="font-medium text-[#172b24]">{selected.preferredDate}</dd></div>
                  <div className="grid grid-cols-[116px_1fr] gap-3"><dt className="text-[#526B62]">Preferred Time</dt><dd className="font-medium text-[#172b24]">{selected.preferredTime}</dd></div>
                  <div className="grid grid-cols-[116px_1fr] gap-3"><dt className="text-[#526B62]">Number of Staff</dt><dd className="font-medium text-[#172b24]">{selected.staff}</dd></div>
                  <div className="grid grid-cols-[116px_1fr] gap-3"><dt className="text-[#526B62]">Request Type</dt><dd className="font-medium text-[#172b24]">Demo</dd></div>
                </dl>
              </section>
              <section className="overflow-hidden rounded-xl border border-[#d4e9df] bg-white p-4 sm:col-span-2">
                <h3 className="-mx-4 -mt-4 mb-3 border-b border-[#d4e9df] bg-gradient-to-r from-[#e7f4ec] to-[#dff4e9] px-4 py-2.5 text-sm font-bold text-[#07543d]">Request Information</h3>
                <dl className="space-y-2.5 text-xs">
                  <div className="grid grid-cols-[116px_1fr] gap-3"><dt className="text-[#526B62]">Submission Date</dt><dd className="font-medium text-[#172b24]">{selected.submitted}</dd></div>
                  <div className="grid grid-cols-[116px_1fr] gap-3"><dt className="text-[#526B62]">Message</dt><dd className="font-medium text-[#172b24]">{selected.notes || 'No message provided.'}</dd></div>
                  <div className="grid grid-cols-[116px_1fr] items-center gap-3"><dt className="text-[#526B62]">Status</dt><dd><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(selected.status)}`}>{selected.status}</span></dd></div>
                </dl>
              </section>
              <section className="overflow-hidden rounded-xl border border-[#d4e9df] bg-white p-4 sm:col-span-2">
                <h3 className="-mx-4 -mt-4 mb-3 border-b border-[#d4e9df] bg-gradient-to-r from-[#e7f4ec] to-[#dff4e9] px-4 py-2.5 text-sm font-bold text-[#07543d]">Admin Actions</h3>
              {mode === 'contact' && <div className="rounded-xl border border-[#b99aff] bg-[#faf7ff] p-4"><h3 className="mb-3 text-sm font-semibold text-[#7044b6]">Demo Process — Contact Record</h3><label className="block text-sm text-[#086b50]">Contact Method<select className="mt-1 w-full rounded-lg border border-[#bfd4fa] bg-white px-3 py-2.5 text-sm"><option>Phone</option><option>Email</option><option>Video Call</option></select></label><label className="mt-3 block text-sm text-[#086b50]">Follow-up Date<input type="date" className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-sm" /></label><label className="mt-3 block text-sm text-[#086b50]">Contact Notes<textarea value={contactNotes} onChange={event => setContactNotes(event.target.value)} placeholder="Details of the conversation..." className="mt-1 h-20 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-sm" /></label></div>}
              {mode === 'schedule' && <div className="rounded-xl border border-[#82b5ff] bg-[#f0f7ff] p-4"><h3 className="mb-3 text-sm font-semibold text-[#086b50]">Schedule Demo Form</h3><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><label className="text-sm text-[#086b50]">Demo Date<input type="date" value={scheduleForm.date} onChange={event => setScheduleForm({ ...scheduleForm, date: event.target.value })} className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-sm" /></label><label className="text-sm text-[#086b50]">Demo Time<input type="time" value={scheduleForm.time} onChange={event => setScheduleForm({ ...scheduleForm, time: event.target.value })} className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-sm" /></label><label className="text-sm text-[#086b50]">Assigned Representative<input value={scheduleForm.representative} onChange={event => setScheduleForm({ ...scheduleForm, representative: event.target.value })} placeholder="e.g. John Cruz" className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-sm" /></label><label className="text-sm text-[#086b50]">Meeting Link<input value={scheduleForm.link} onChange={event => setScheduleForm({ ...scheduleForm, link: event.target.value })} placeholder="https://meet.google.com/..." className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-sm" /></label></div><label className="mt-3 block text-sm text-[#086b50]">Additional Notes<textarea value={scheduleForm.notes} onChange={event => setScheduleForm({ ...scheduleForm, notes: event.target.value })} placeholder="Any notes for the demo..." className="mt-1 h-16 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-sm" /></label></div>}
              {mode === 'view' && <div className="flex flex-wrap gap-2">{selected.status === 'New' && <><button onClick={() => setMode('contact')} className="rounded-full border border-[#078c63] bg-white px-4 py-2 text-xs font-semibold text-[#087a59] transition hover:bg-[#eff9f3]">Record Contact</button><button onClick={() => setMode('schedule')} className="rounded-full bg-[#087a59] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#065c44]">Schedule Demo</button><button onClick={() => updateStatus('Cancelled', `${selected.clinic} demo request cancelled.`, 'error')} className="rounded-full border border-[#c43636] bg-white px-4 py-2 text-xs font-semibold text-[#c43636] transition hover:bg-[#fff1f1]">Cancel</button></>}{selected.status === 'Contacted' && <><button onClick={() => setMode('schedule')} className="rounded-full bg-[#087a59] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#065c44]">Schedule Demo</button><button onClick={() => updateStatus('Completed', `${selected.clinic} demo marked as Completed.`)} className="rounded-full border border-[#078c63] bg-white px-4 py-2 text-xs font-semibold text-[#087a59] transition hover:bg-[#eff9f3]">Mark Completed</button></>}{selected.status === 'Scheduled' && <button onClick={() => updateStatus('Completed', `${selected.clinic} demo marked as Completed.`)} className="rounded-full bg-[#087a59] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#065c44]">Mark Completed</button>}</div>}
              {mode === 'view' && ['Completed', 'Cancelled'].includes(selected.status) && (
                editingStatus ? (
                  <div className="space-y-3 rounded-xl border border-[#d4e3d7] bg-[#f7fbf8] p-3">
                    <label className="block text-xs font-medium text-[#526B62]">
                      Request Status
                      <select
                        value={statusDraft}
                        onChange={event => setStatusDraft(event.target.value as DemoStatus)}
                        className="mt-1.5 w-full rounded-lg border border-[#d4e3d7] bg-white px-3 py-2.5 text-sm text-[#172b24] outline-none focus:border-[#087a59] focus:ring-2 focus:ring-[#087a59]/20"
                      >
                        {demoStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => updateStatus(statusDraft, `Demo request status changed to ${statusDraft}.`, 'success', false)} className="rounded-full bg-[#087a59] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#065c44]">Save Status</button>
                      <button onClick={() => { setStatusDraft(selected.status); setEditingStatus(false); }} className="rounded-full border border-[#078c63] bg-white px-4 py-2 text-xs font-semibold text-[#087a59] transition hover:bg-[#eff9f3]">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f3f8f5] px-3 py-2.5">
                    <p className="text-xs text-[#526B62]">
                      {selected.status === 'Cancelled'
                        ? 'This request was cancelled.'
                        : 'This request is completed.'}
                    </p>
                    <button onClick={() => { setStatusDraft(selected.status); setEditingStatus(true); }} className="rounded-full border border-[#078c63] bg-white px-4 py-2 text-xs font-semibold text-[#087a59] transition hover:bg-[#eff9f3]">Edit Status</button>
                  </div>
                )
              )}
              {mode !== 'view' && <div className="flex flex-wrap gap-2"><button onClick={() => mode === 'contact' ? updateStatus('Contacted', `${selected.clinic} marked as Contacted. Notification sent.`) : updateStatus('Scheduled', `Demo scheduled for ${selected.clinic}. Notification sent to clinic.`)} className="rounded-full bg-[#087a59] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#065c44]">{mode === 'contact' ? 'Save & Notify Clinic' : 'Confirm & Notify Clinic'}</button><button onClick={() => setMode('view')} className="rounded-full border border-[#078c63] bg-white px-4 py-2 text-xs font-semibold text-[#087a59] transition hover:bg-[#eff9f3]">Back</button></div>}
              </section>
              </div>
            </div>
            <div className="flex shrink-0 justify-end border-t border-[#e2eee7] px-5 py-3">
              <button onClick={() => setSelected(null)} className="rounded-full border border-[#087a59] px-4 py-2 text-xs font-semibold text-[#087a59] hover:bg-[#eff9f3]">Close</button>
            </div>
          </section>
        </div>,
          document.body,
        )}
    </div>
  );
}

export function Inbox() {
  type InboxMessage = {
    id: string;
    senderName: string;
    senderEmail: string;
    subject: string;
    audience: 'Pet Owner' | 'Veterinary Clinic';
    body: string;
    createdAt: string;
    isRead: boolean;
  };
  const [selected, setSelected] = useState('');
  const [filter, setFilter] = useState<'All' | 'Unread' | 'Clinics' | 'Pet Owners'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [reply, setReply] = useState('');
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loadError, setLoadError] = useState('');
  const [replyError, setReplyError] = useState('');
  useEffect(() => {
    apiFetch('/api/messages').then(async response => {
      if (!response.ok) throw new Error('Failed to load messages');
      return response.json();
    }).then(data => {
      const loadedMessages: InboxMessage[] = data.map((item: any) => ({
        id: String(item.id),
        senderName: item.sender_name || item.sender || 'Unknown',
        senderEmail: item.sender_email || item.email || '',
        subject: item.subject || 'Message',
        audience: item.audience === 'Pet Owner' || item.audience === 'pet_owner' ? 'Pet Owner' : 'Veterinary Clinic',
        body: item.body || item.message || '',
        createdAt: item.created_at || '',
        isRead: Boolean(item.is_read),
      }));
      setMessages(loadedMessages);
      setSelected(current => current || loadedMessages[0]?.id || '');
    }).catch(error => {
      setLoadError(error instanceof Error ? error.message : 'Failed to load messages');
    });
  }, []);
  const visibleMessages = messages.filter(message => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || `${message.senderName} ${message.senderEmail} ${message.subject} ${message.body}`.toLowerCase().includes(query);
    const matchesFilter = filter === 'All'
      || (filter === 'Unread' && !message.isRead)
      || (filter === 'Clinics' && message.audience === 'Veterinary Clinic')
      || (filter === 'Pet Owners' && message.audience === 'Pet Owner');
    return matchesSearch && matchesFilter;
  });
  const activeMessage = visibleMessages.find(message => message.id === selected) || visibleMessages[0] || null;
  const formatMessageDate = (value: string, includeTime = false) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, includeTime
      ? { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
      : { month: 'numeric', day: 'numeric', year: 'numeric' });
  };
  const getInitials = (name: string) => name.split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase() || 'UN';
  const sendReply = async () => {
    if (!reply.trim() || !activeMessage) return;
    setReplyError('');
    try {
      const response = await apiFetch(`/api/messages/${activeMessage.id}/replies`, {
        method: 'POST',
        body: JSON.stringify({ body: reply.trim() }),
      });
      if (!response.ok) throw new Error('Failed to send reply');
      setReply('');
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : 'Failed to send reply');
    }
  };
  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-[480px] flex-col overflow-hidden bg-gradient-to-br from-[#e7f7ef] via-[#f6fcf8] to-[#d3efe2] p-2 text-sm sm:p-3 lg:p-4">
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(220px,38%)_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[#cfe8dc] bg-white/90 shadow-[0_8px_28px_rgba(14,86,62,0.12)] backdrop-blur lg:grid-cols-[295px_minmax(0,1fr)] lg:grid-rows-1">
        <aside className="flex min-h-0 flex-col border-b border-[#d4e9de] bg-white/90 lg:border-b-0 lg:border-r">
          <div className="shrink-0 border-b border-[#e2f0e8] p-3">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#77b69a]" />
                <input
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  className="h-10 w-full rounded-full border border-[#cfe4d8] bg-white px-9 text-xs text-[#172b24] outline-none placeholder:text-[#82998f] focus:border-[#087a59] focus:ring-0 focus:shadow-[0_0_0_3px_rgba(8,122,89,0.18)]"
                  placeholder="Search messages..."
                  aria-label="Search messages"
                />
              </div>
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e1f5eb] text-[#087a59]">
                <SlidersHorizontal className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
              {(['All', 'Unread', 'Clinics', 'Pet Owners'] as const).map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition ${filter === item ? 'bg-[#087a59] text-white shadow-sm' : 'bg-[#e5f5ec] text-[#3f6253] hover:bg-[#d8f0e3]'}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loadError ? (
              <p role="alert" className="px-3 py-6 text-center text-xs text-[#b42318]">{loadError}</p>
            ) : visibleMessages.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-[#789087]">{messages.length ? 'No messages match your filters.' : 'No messages yet.'}</p>
            ) : visibleMessages.map(message => (
              <button
                key={message.id}
                type="button"
                onClick={() => setSelected(message.id)}
                className={`mb-1.5 flex w-full gap-3 rounded-xl p-3 text-left transition ${activeMessage?.id === message.id ? 'bg-[#def6eb]' : 'bg-white hover:bg-[#f2faf5]'}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#12a675] to-[#087a59] text-[11px] font-semibold text-white shadow-sm">
                  {getInitials(message.senderName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-[#173c2f]">{message.senderName}</span>
                    <span className="shrink-0 text-[10px] text-[#16815d]">{formatMessageDate(message.createdAt)}</span>
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-[#315b4a]">{message.body || message.subject}</span>
                </span>
                {!message.isRead && <span className="mt-5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1bb478]" aria-label="Unread" />}
              </button>
            ))}
          </div>
        </aside>
        <section className="flex min-h-0 min-w-0 flex-col">
          {activeMessage ? (
            <>
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#dceee4] bg-white/90 px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#12a675] to-[#087a59] text-xs font-semibold text-white shadow-sm">
                    {getInitials(activeMessage.senderName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#173c2f]">{activeMessage.senderName}</p>
                    <p className="truncate text-xs text-[#16815d]">{activeMessage.senderEmail}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#14865f]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#58d68d]" />
                      {activeMessage.audience}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="max-w-[200px] truncate text-xs font-semibold text-[#173c2f] sm:max-w-xs">{activeMessage.subject}</p>
                  <p className={`mt-1 text-[11px] ${activeMessage.isRead ? 'text-[#16815d]' : 'text-[#a16a08]'}`}>{activeMessage.isRead ? 'Read' : 'Unread'}</p>
                </div>
              </header>
              <div className="relative min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_9%_100%,rgba(225,249,238,0.8),transparent_36%),radial-gradient(ellipse_at_100%_82%,rgba(204,244,225,0.72),transparent_34%),linear-gradient(135deg,#ffffff_24%,#f8fcf9_100%)] p-4 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#12a675] to-[#087a59] text-[10px] font-semibold text-white">
                    {getInitials(activeMessage.senderName)}
                  </span>
                  <div className="min-w-0">
                    <p className="mb-1.5 text-[11px] font-medium text-[#16815d]">
                      {formatMessageDate(activeMessage.createdAt, true)}
                    </p>
                    <div className="max-w-3xl rounded-2xl rounded-tl-md border border-[#ccebdd] bg-[#e1f6ec]/95 px-4 py-3 text-sm leading-6 text-[#183d30] shadow-sm">
                      {activeMessage.body}
                    </div>
                  </div>
                </div>
              </div>
              <form
                onSubmit={event => { event.preventDefault(); void sendReply(); }}
                className="shrink-0 border-t border-[#dceee4] bg-white/90 p-3 sm:px-4 sm:py-3"
              >
                {replyError && <p role="alert" className="mb-2 text-xs text-[#b42318]">{replyError}</p>}
                <div className="flex items-center gap-2">
                  <input
                    value={reply}
                    onChange={event => setReply(event.target.value)}
                    className="h-12 min-w-0 flex-1 rounded-2xl border border-[#cfe4d8] bg-white px-4 text-xs text-[#172b24] outline-none placeholder:text-[#82998f] focus:border-[#087a59] focus:ring-0 focus:shadow-[0_0_0_3px_rgba(8,122,89,0.18)]"
                    placeholder={`Reply to ${activeMessage.senderName}...`}
                    aria-label={`Reply to ${activeMessage.senderName}`}
                  />
                  <button
                    type="submit"
                    disabled={!reply.trim()}
                    aria-label="Send message"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#075b43] text-white shadow-sm transition hover:bg-[#087a59] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center bg-[radial-gradient(ellipse_at_9%_100%,rgba(225,249,238,0.8),transparent_36%),linear-gradient(135deg,#ffffff_24%,#f8fcf9_100%)] px-6 text-center text-sm text-[#789087]">
              Select a message to view the conversation.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] text-[#a9d6b7]">{label}</p><p className="text-xs font-semibold text-[#172b24] mt-1">{value}</p></div>; }
function ReferenceTablePage({ title: _title, columns, rows, stats = [] }: { title: string; columns: string[]; rows: string[][]; stats?: string[] }) { return <div className={shell}>{stats.length > 0 && <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{stats.map((stat) => <div className={`${card} p-4 text-sm font-semibold text-[#172b24]`} key={stat}>{stat}</div>)}</div>}<div className={`${card} overflow-x-auto`}><div className="flex items-center justify-between border-b border-[#d4e3d7] p-3"><div className="relative"><Search className="absolute left-2 top-2 h-3 w-3 text-[#a9d6b7]" /><input className="w-64 rounded-lg border border-[#d4e3d7] bg-[#fafbf8] py-1.5 pl-7 text-xs" placeholder="Search..." /></div><button className={`${button} bg-[#086b50] text-white`}><Plus className="mr-1 inline h-3 w-3" />New Application</button></div><table className="w-full text-left"><thead className="bg-[#e7f4ec]"> <tr>{columns.map((column) => <th className="px-3 py-2 text-[10px] font-semibold text-[#526B62]" key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr className="border-t border-[#e3ecfb]" key={rowIndex}>{row.map((cell, cellIndex) => <td className="px-3 py-3 text-[11px] text-[#526B62]" key={cellIndex}>{cellIndex === row.length - 1 ? <span className="rounded-full bg-[#e7f4ec] px-2 py-1 text-[#086b50]">{cell}</span> : cell}</td>)}</tr>)}</tbody></table></div></div>; }
