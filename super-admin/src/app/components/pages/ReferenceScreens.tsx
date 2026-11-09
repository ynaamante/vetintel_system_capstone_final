import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Check,
  ChevronDown,
  Download,
  Mail,
  Plus,
  Search,
  Send,
  Shield,
  UserPlus,
  Video,
} from 'lucide-react';

const shell = 'p-5 space-y-4 bg-[#fafbf8] min-h-full';
const card = 'bg-white rounded-lg border border-[#d4e3d7]';
const button = 'rounded-lg px-4 py-2 text-xs font-semibold';

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
    requestedRoles: Array<{ role: string; count: number }>;
  };

  const [clinics, setClinics] = useState<ActiveClinic[]>([]);
  const [selectedClinic, setSelectedClinic] = useState<ActiveClinic | null>(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  useEffect(() => {
    apiFetch('/api/clinics')
      .then(async response => {
        if (!response.ok) throw new Error('Failed to load clinics');
        return response.json();
      })
      .then(data => setClinics(data.map((clinic: any) => ({
        id: clinic.id,
        name: clinic.name,
        owner: clinic.owner || 'Unknown',
        staff: String(clinic.metadata?.application?.staffCount ?? clinic.total_users ?? 0),
        plan: clinic.metadata?.application?.plan || clinic.metadata?.plan || '—',
        status: clinic.status === 'active' ? 'Active' : clinic.status === 'pending' ? 'Pending Activation' : 'Suspended',
        date: clinic.created_at ? new Date(clinic.created_at).toLocaleDateString() : '—',
        email: clinic.email || '',
        phone: clinic.phone || '',
        address: clinic.address || '',
        expiry: clinic.metadata?.subscriptionExpiry || 'Not set',
        requestedRoles: Array.isArray(clinic.metadata?.application?.requestedRoles)? clinic.metadata.application.requestedRoles.map((item: any) => ({
        role: item.role || 'Unspecified role',
        count: Number(item.count) || 0,
    }))
  : [],
      }))))
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

  const filteredClinics = clinics.filter((clinic) => `${clinic.name} ${clinic.owner}`.toLowerCase().includes(search.toLowerCase()));
  const activeCount = clinics.filter((clinic) => clinic.status === 'Active').length;
  const pendingCount = clinics.filter((clinic) => clinic.status === 'Pending Activation').length;
  const suspendedCount = clinics.filter((clinic) => clinic.status === 'Suspended').length;
  const statusClass = (status: ActiveClinic['status']) => status === 'Active' ? 'text-[#078c63]' : status === 'Suspended' ? 'text-[#c43636]' : 'text-[#c98200]';

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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['3', 'Active', 'bg-[#d8f7e9] text-[#078c63]'],
          ['1', 'Pending Activation', 'bg-[#fff1c9] text-[#c98200]'],
          ['1', 'Suspended', 'bg-[#ffe0e0] text-[#c43636]'],
          ['0', 'Archived', 'bg-[#eef1f5] text-[#718096]'],
        ].map(([value, label, color]) => (
          <div className={`${card} p-4`} key={label}>
            <p className="text-2xl font-semibold text-[#172b24]">{label === 'Active' ? activeCount : label === 'Pending Activation' ? pendingCount : label === 'Suspended' ? suspendedCount : value}</p>
            <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-medium ${color}`}>{label}</span>
          </div>
        ))}
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-[#d4e3d7] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#172b24]">All Clinics</h2>
          <div className="relative w-52">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#a9d6b7]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-lg border border-[#d4e3d7] bg-[#fafbf8] py-2 pl-8 text-xs" placeholder="Search..." />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#e7f4ec]">
              <tr>{['Clinic Name', 'Owner', 'Staff Count', 'Plan', 'Status', 'Registration Date', 'Action'].map((heading) => <th className="px-4 py-2 text-xs font-semibold text-[#526B62]" key={heading}>{heading}</th>)}</tr>
            </thead>
            <tbody>
              {filteredClinics.map((clinic) => (
                <tr className="border-t border-[#e3ecfb]" key={clinic.name}>
                  <td className="px-4 py-3 text-sm font-medium text-[#172b24]">{clinic.name}{clinic.expiry === 'Expired' && <span className="ml-2 rounded bg-[#fff1c9] px-1.5 py-1 text-[10px] text-[#c98200]">Expired</span>}{clinic.name === 'Metro Pet Care Center' && <span className="ml-2 rounded bg-[#fff1c9] px-1.5 py-1 text-[10px] text-[#c98200]">Exp. 12d</span>}</td>
                  <td className="px-4 py-3 text-sm text-[#526B62]">{clinic.owner}</td>
                  <td className="px-4 py-3 text-sm text-[#526B62]">{clinic.staff}</td>
                  <td className="px-4 py-3 text-sm text-[#526B62]">{clinic.plan}</td>
                  <td className={`px-4 py-3 text-sm font-medium ${statusClass(clinic.status)}`}>{clinic.status}</td>
                  <td className="px-4 py-3 text-sm text-[#526B62]">{clinic.date}</td>
                  <td className="px-4 py-3"><button onClick={() => setSelectedClinic(clinic)} className="rounded-lg bg-[#e7f4ec] px-3 py-1.5 text-sm text-[#086b50]">View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedClinic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#152744]/60 p-3">
          <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#d8e3f8] px-6 py-5">
              <div><h2 className="text-lg font-bold text-[#172b24]">{selectedClinic.name}</h2><p className={`mt-1 text-sm ${statusClass(selectedClinic.status)}`}>{selectedClinic.status}</p></div>
              <button onClick={() => setSelectedClinic(null)} className="text-2xl text-[#4870ba]">×</button>
            </div>
            {selectedClinic.name === 'Metro Pet Care Center' && <div className="mx-6 mt-5 flex items-center justify-between rounded-xl border border-[#ffc933] bg-[#fffaf0] px-4 py-3 text-sm text-[#a45b00]"><span>⚠ Plan expiring in 12 days (Sep 15, 2026).</span><button onClick={() => showNotice(`Expiry notification sent to ${selectedClinic.name}.`, 'success')} className="rounded-xl bg-[#df7a00] px-4 py-2 font-bold text-white">Notify Clinic</button></div>}
            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <section className="rounded-xl bg-[#eef4ff] p-4"><h3 className="mb-3 text-sm font-bold uppercase text-[#086b50]">Clinic Information</h3><div className="space-y-2 text-sm text-[#172b24]"><p>Clinic Name: <span className="text-[#526B62]">{selectedClinic.name}</span></p><p>Address: <span className="text-[#526B62]">{selectedClinic.address}</span></p><p>Email: <span className="text-[#526B62]">{selectedClinic.email}</span></p><p>Phone: <span className="text-[#526B62]">{selectedClinic.phone}</span></p><p>Registered: <span className="text-[#526B62]">{selectedClinic.date}</span></p></div></section>
                <section className="rounded-xl bg-[#eef4ff] p-4"><h3 className="mb-3 text-sm font-bold uppercase text-[#086b50]">Subscription</h3><div className="space-y-2 text-sm text-[#172b24]"><p>Plan: <span className="text-[#526B62]">{selectedClinic.plan}</span></p><p>Price: <span className="text-[#526B62]">$129/mo</span></p><p>Plan Status: <span className="text-[#526B62]">{selectedClinic.status}</span></p><p>Expiry Date: <span className="text-[#526B62]">{selectedClinic.expiry}</span></p><p>Total Staff: <span className="text-[#526B62]">{selectedClinic.staff}</span></p></div></section>
              </div>
             <section className="rounded-xl border border-[#bcd2fb]">
                  <div className="flex justify-between border-b border-[#bcd2fb] bg-[#eef4ff] px-4 py-3 text-sm font-bold uppercase text-[#086b50]">
                    <span>Requested Staff Structure</span>
                    <span className="font-normal normal-case text-[#526B62]">
                      {selectedClinic.staff} staff slots
                    </span>
                  </div>

                  {selectedClinic.requestedRoles.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-[#526B62]">
                      No requested staff roles were submitted.
                    </p>
                  ) : (
                    selectedClinic.requestedRoles.map((staff) => (
                      <div
                        className="grid grid-cols-3 border-b border-[#e3ecfb] px-4 py-3 text-sm last:border-0"
                        key={staff.role}
                      >
                        <span className="text-[#172b24]">{staff.role}</span>
                        <span className="text-[#526B62]">
                          {staff.count} {staff.count === 1 ? 'slot' : 'slots'}
                        </span>
                        <span className="text-[#078c63]">Requested</span>
                      </div>
                    ))
                  )}
                  </section>
              <div><h3 className="mb-2 text-sm font-bold uppercase text-[#4870ba]">Change Status</h3><div className="flex gap-2"><button onClick={() => updateStatus('Suspended', `${selectedClinic.name} has been suspendd.`)} className="rounded-xl bg-[#df7a00] px-4 py-2.5 text-sm font-bold text-white">Suspend</button><button onClick={() => updateStatus('Suspended', `${selectedClinic.name} has been archived.`)} className="rounded-xl bg-[#6b7280] px-4 py-2.5 text-sm font-bold text-white">Archive</button></div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function RoleRequests() {
  type RoleRequest = {
    id: number;
    clinic: string;
    role: string;
    users: string;
    date: string;
    status: 'Pending' | 'Under Review' | 'Approved' | 'Rejected';
    reason: string;
  };
  const navigate = useNavigate();
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RoleRequest | null>(null);
  const [notice, setNotice] = useState<{ message: string; kind: 'success' | 'error' | 'info' } | null>(null);

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
      role: item.role || item.requested_role || '—', users: String(item.users || item.requested_users || 1),
      date: item.created_at ? new Date(item.created_at).toLocaleDateString() : '—',
      status: item.status || 'Pending', reason: item.reason || '',
    })))).catch(error => showNotice(error instanceof Error ? error.message : 'Failed to load role requests', 'error'));
  }, []);

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
      <div className="space-y-4">
        {requests.map(request => (
          <div className={`${card} p-5 md:p-6`} key={`${request.clinic}-${request.role}`}>
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.6fr_1fr_1fr_auto]">
              <div>
                <div className="flex items-center gap-4 text-base font-semibold text-[#172b24]">
                  {request.clinic}
                  <span className={`text-sm font-medium ${statusClass(request.status)}`}>{request.status}</span>
                </div>
                <p className="mt-4 text-sm text-[#7896c8]">Requested Role</p>
                <p className="text-base font-semibold text-[#172b24]">{request.role}</p>
              </div>
              <Metric label="Requested Users" value={request.users} />
              <Metric label="Date Submitted" value={request.date} />
              <button onClick={() => setSelectedRequest(request)} className="self-center rounded-lg bg-[#086b50] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#174fbf]">Review</button>
            </div>
            <div className="mt-5 rounded-lg bg-[#fafbf8] px-4 py-3 text-sm text-[#526B62]"><strong>Reason:</strong> {request.reason}</div>
          </div>
        ))}
      </div>
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#152744]/60 p-4">
          <div className="w-full max-w-[512px] rounded-2xl bg-white p-7 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Role Request — {selectedRequest.clinic}</h2>
              <button onClick={() => setSelectedRequest(null)} className="text-2xl text-[#4870ba]">×</button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-[#eef4ff] p-5 text-base">
              <p>Requested Role: <span className="text-[#526B62]">{selectedRequest.role}</span></p>
              <p>Users: <span className="text-[#526B62]">{selectedRequest.users}</span></p>
              <p>Date: <span className="text-[#526B62]">{selectedRequest.date}</span></p>
              <p>Status: <span className={statusClass(selectedRequest.status)}>{selectedRequest.status}</span></p>
            </div>
            <p className="mt-4 rounded-xl bg-[#eef4ff] p-5 text-base">Reason: <span className="text-[#526B62]">{selectedRequest.reason}</span></p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              <button onClick={() => updateRequest('Approved', `Role request approved for ${selectedRequest.clinic}.`, 'success')} className="rounded-lg bg-[#079669] px-3 py-3 text-sm font-semibold text-white">Approve</button>
              <button onClick={() => updateRequest('Rejected', `Role request rejected for ${selectedRequest.clinic}.`, 'error')} className="rounded-lg bg-[#e52d2d] px-3 py-3 text-sm font-semibold text-white">Reject</button>
              <button onClick={() => updateRequest('Under Review', `Information requested from ${selectedRequest.clinic}.`, 'info')} className="rounded-lg bg-[#e7f4ec] px-3 py-3 text-sm font-semibold text-[#086b50]">Request Info</button>
            </div>
          </div>
        </div>
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
    staffLimit: string;
    features: string[];
    active: boolean;
  };
  const [plans, setPlans] = useState<Plan[]>([]);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [createForm, setCreateForm] = useState<Plan>({
    name: '',
    description: '',
    price: '$',
    staffLimit: '5',
    features: [],
    active: true,
  });
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editForm, setEditForm] = useState<Plan | null>(null);
  const [newFeature, setNewFeature] = useState('');
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
      staffLimit: String(item.staff_limit || item.staffLimit || ''), features: item.features || [], active: item.status !== 'inactive',
    })))).catch(error => showNotice(error instanceof Error ? error.message : 'Failed to load subscription plans', 'info'));
  }, []);

  const openEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setEditForm({ ...plan, features: [...plan.features] });
    setNewFeature('');
  };

  const openCreatePlan = () => {
    setCreateForm({ name: '', description: '', price: '$', staffLimit: '5', features: [], active: true });
    setNewFeature('');
    setCreatingPlan(true);
  };

  const saveNewPlan = () => {
    if (!createForm.name.trim() || !createForm.description.trim()) {
      showNotice('Please enter a plan name and description.', 'info');
      return;
    }
    apiFetch('/api/subscription-plans', { method: 'POST', body: JSON.stringify({ ...createForm, name: createForm.name.trim(), description: createForm.description.trim() }) })
      .then(async response => { if (!response.ok) throw new Error('Failed to create plan'); return response.json(); })
      .then(item => {
        setPlans(current => [...current, { ...createForm, id: item.id, name: createForm.name.trim(), description: createForm.description.trim() }]);
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
        <button onClick={openCreatePlan} className={`${button} bg-[#086b50] text-sm text-white`}><Plus className="mr-1 inline h-4 w-4" />Create Plan</button>
      </div>
      {notice && (
        <div className={`fixed right-6 top-6 z-[100] flex items-center gap-3 rounded-xl border px-5 py-3 text-sm shadow-lg ${
          notice.kind === 'success' ? 'border-[#7ce3af] bg-[#f0fff6]' : 'border-[#82b5ff] bg-[#f0f7ff]'
        }`}>
          <span className={`text-lg ${notice.kind === 'success' ? 'text-[#079669]' : 'text-[#086b50]'}`}>{notice.kind === 'success' ? '✓' : 'ⓘ'}</span>
          {notice.message}
        </div>
      )}
      <p className="text-sm text-[#526B62]">Manage subscription plans available to clinics.</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {plans.map(plan => (
          <div className={`${card} flex flex-col p-5`} key={plan.name}>
            <div className="flex justify-between gap-3">
              <div><h2 className="text-base font-semibold text-[#172b24]">{plan.name}</h2><p className="mt-1 text-sm text-[#526B62]">{plan.description}</p></div>
              <span className={`h-fit rounded-full px-3 py-2 text-xs font-medium ${plan.active ? 'bg-[#d8f7e9] text-[#079669]' : 'bg-[#eef1f5] text-[#718096]'}`}>{plan.active ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="mt-4 text-2xl font-semibold text-[#086b50]">{plan.price} <span className="text-sm font-normal text-[#a9d6b7]">/ monthly</span></div>
            <div className="my-5 border-t border-[#e3ecfb] pt-4">
              <p className="text-xs uppercase text-[#a9d6b7]">Staff Limit</p>
              <p className="mt-1 text-sm font-semibold text-[#172b24]">Up to {plan.staffLimit} staff accounts</p>
              <p className="mt-4 text-xs uppercase text-[#a9d6b7]">Features</p>
              <ul className="mt-2 space-y-1.5">{plan.features.map(feature => <li className="text-sm text-[#526B62]" key={feature}><Check className="mr-2 inline h-3.5 w-3.5 text-[#086b50]" />{feature}</li>)}</ul>
            </div>
            <div className="mt-auto grid grid-cols-2 gap-2">
              <button onClick={() => openEditPlan(plan)} className={`${button} bg-[#e7f4ec] text-sm text-[#086b50]`}>Edit Plan</button>
              <button onClick={() => togglePlan(plan)} className={`${button} text-sm ${plan.active ? 'bg-[#ffe2e2] text-[#c43636]' : 'bg-[#d8f7e9] text-[#079669]'}`}>{plan.active ? 'Deactivate' : 'Activate'}</button>
            </div>
          </div>
        ))}
      </div>
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
                <input value={createForm.price} onChange={event => setCreateForm({ ...createForm, price: event.target.value })} className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-base text-[#172b24] outline-none focus:ring-2 focus:ring-[#8eb5ff]" />
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
                <ul className="space-y-1.5">{createForm.features.map((feature, index) => <li className="flex items-center justify-between rounded-lg bg-[#eef4ff] px-3 py-2 text-sm text-[#526B62]" key={`${feature}-${index}`}>{feature}<button onClick={() => setCreateForm({ ...createForm, features: createForm.features.filter((_, itemIndex) => itemIndex !== index) })} className="text-sm text-[#e52d2d]">Remove</button></li>)}</ul>
              )}
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button onClick={saveNewPlan} className="rounded-lg bg-[#086b50] px-4 py-3 text-sm font-semibold text-white">Save Plan</button>
              <button onClick={() => setCreatingPlan(false)} className="rounded-lg bg-[#e7f4ec] px-4 py-3 text-sm text-[#086b50]">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {editingPlan && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#152744]/60 p-4">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[512px] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#d4e3d7] px-6 py-5">
              <h2 className="text-lg font-bold">Edit — {editingPlan.name}</h2>
              <button onClick={() => { setEditingPlan(null); setEditForm(null); }} className="text-2xl text-[#4870ba]">×</button>
            </div>
            <div className="space-y-4 px-6 py-5">
              {[
                ['Plan Name', 'name'],
                ['Description', 'description'],
                ['Price', 'price'],
              ].map(([label, key]) => (
                <label className="block text-sm text-[#086b50]" key={key}>{label}
                  <input value={editForm[key as keyof Plan] as string} onChange={event => setEditForm({ ...editForm, [key]: event.target.value })} className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-base text-[#172b24] outline-none focus:ring-2 focus:ring-[#8eb5ff]" />
                </label>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <label className="text-sm text-[#086b50]">Billing Cycle<select className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-base text-[#172b24]"><option>Monthly</option><option>Yearly</option></select></label>
                <label className="text-sm text-[#086b50]">Staff Limit<input value={editForm.staffLimit} onChange={event => setEditForm({ ...editForm, staffLimit: event.target.value })} className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-base text-[#172b24]" /></label>
              </div>
              <label className="block text-sm text-[#086b50]">Features
                <div className="mt-1 flex gap-2"><input value={newFeature} onChange={event => setNewFeature(event.target.value)} placeholder="Add a feature..." className="min-w-0 flex-1 rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-base text-[#172b24]" /><button onClick={() => { if (newFeature.trim()) { setEditForm({ ...editForm, features: [...editForm.features, newFeature.trim()] }); setNewFeature(''); } }} className="rounded-lg bg-[#086b50] px-4 text-sm font-semibold text-white">Add</button></div>
              </label>
              <ul className="space-y-1.5">{editForm.features.map((feature, index) => <li className="flex items-center justify-between rounded-lg bg-[#eef4ff] px-3 py-2 text-sm text-[#526B62]" key={`${feature}-${index}`}>{feature}<button onClick={() => setEditForm({ ...editForm, features: editForm.features.filter((_, itemIndex) => itemIndex !== index) })} className="text-sm text-[#e52d2d]">Remove</button></li>)}</ul>
            </div>
            <div className="flex gap-2 px-6 pb-6"><button onClick={savePlan} className="rounded-lg bg-[#086b50] px-4 py-3 text-sm font-semibold text-white">Save Plan</button><button onClick={() => { setEditingPlan(null); setEditForm(null); }} className="rounded-lg bg-[#e7f4ec] px-4 py-3 text-sm text-[#086b50]">Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
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
  const openRequest = (request: DemoRequest) => { setSelected(request); setMode('view'); };
  const updateStatus = (status: DemoStatus, message: string, kind: 'success' | 'error' = 'success') => {
    if (!selected) return;
    apiFetch(`/api/demo-requests/${selected.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      .then(async response => { if (!response.ok) throw new Error('Failed to update demo request'); })
      .then(() => {
        setRequests(current => current.map(request => request.id === selected.id ? { ...request, status } : request));
        setSelected(null);
        showNotice(message, kind);
      }).catch(error => showNotice(error instanceof Error ? error.message : 'Failed to update demo request', 'error'));
  };
  const statusClass = (status: DemoStatus) => status === 'Completed' ? 'text-[#078c63]' : status === 'Cancelled' ? 'text-[#718096]' : status === 'Scheduled' ? 'text-[#c98200]' : status === 'Contacted' ? 'text-[#7044b6]' : 'text-[#172b24]';

  return (
    <div className={shell}>
      {notice && <div className={`fixed right-6 top-6 z-[100] flex items-center gap-3 rounded-xl border px-5 py-3 text-sm shadow-lg ${notice.kind === 'success' ? 'border-[#7ce3af] bg-[#f0fff6]' : 'border-[#ff8a8a] bg-[#fff8f8]'}`}><span className={`text-lg ${notice.kind === 'success' ? 'text-[#079669]' : 'text-[#ef3030]'}`}>{notice.kind === 'success' ? '✓' : 'ⓘ'}</span>{notice.message}</div>}
      <div className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-end border-b border-[#d4e3d7] px-4 py-4"><span className="rounded-full bg-[#dff2fc] px-3 py-1 text-xs text-[#16759f]">{requests.filter(request => request.status === 'New').length} New</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left"><thead className="bg-[#e7f4ec]"><tr>{['Clinic Name', 'Contact Person', 'Phone', 'Staff #', 'Preferred Date', 'Submitted', 'Status', 'Actions'].map(heading => <th className="px-4 py-3 text-xs font-semibold text-[#526B62]" key={heading}>{heading}</th>)}</tr></thead><tbody>{requests.map(request => <tr className="border-t border-[#e3ecfb]" key={request.clinic}><td className="px-4 py-3 text-sm font-medium">{request.clinic}</td><td className="px-4 py-3 text-sm text-[#526B62]">{request.contact}</td><td className="px-4 py-3 text-sm text-[#526B62]">{request.phone}</td><td className="px-4 py-3 text-sm text-[#526B62]">{request.staff}</td><td className="px-4 py-3 text-sm text-[#526B62]">{request.preferredDate}</td><td className="px-4 py-3 text-sm text-[#526B62]">{request.submitted}</td><td className={`px-4 py-3 text-sm font-medium ${statusClass(request.status)}`}>{request.status}</td><td className="px-4 py-3"><button onClick={() => openRequest(request)} className="rounded-lg bg-[#e7f4ec] px-3 py-1.5 text-sm text-[#086b50]">View</button></td></tr>)}</tbody></table></div>
      </div>
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#152744]/60 p-4">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[672px] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#d4e3d7] px-6 py-5"><div><h2 className="text-lg font-bold">{selected.clinic}</h2><p className={`mt-1 text-sm ${statusClass(selected.status)}`}>{selected.status}</p></div><button onClick={() => setSelected(null)} className="text-2xl text-[#4870ba]">×</button></div>
            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="rounded-xl bg-[#eef4ff] p-4 text-sm leading-7"><h3 className="mb-1 text-xs font-semibold text-[#086b50]">CLINIC INFORMATION</h3><p>Clinic: <span className="text-[#526B62]">{selected.clinic}</span></p><p>Address: <span className="text-[#526B62]">{selected.address}</span></p><p>Number of Staff: <span className="text-[#526B62]">{selected.staff}</span></p></div><div className="rounded-xl bg-[#eef4ff] p-4 text-sm leading-7"><h3 className="mb-1 text-xs font-semibold text-[#086b50]">CONTACT INFORMATION</h3><p>Contact Person: <span className="text-[#526B62]">{selected.contact}</span></p><p>Email: <span className="text-[#526B62]">{selected.email}</span></p><p>Phone: <span className="text-[#526B62]">{selected.phone}</span></p></div></div>
              <div className="rounded-xl bg-[#eef4ff] p-4 text-sm leading-7"><p>Preferred Date: <span className="text-[#526B62]">{selected.preferredDate}</span> <span className="ml-5">Preferred Time: <span className="text-[#526B62]">{selected.preferredTime}</span></span> <span className="ml-5">Submitted: <span className="text-[#526B62]">{selected.submitted}</span></span></p><p><strong>Notes:</strong> <span className="text-[#526B62]">{selected.notes}</span></p></div>
              {mode === 'contact' && <div className="rounded-xl border border-[#b99aff] bg-[#faf7ff] p-4"><h3 className="mb-3 text-sm font-semibold text-[#7044b6]">Demo Process — Contact Record</h3><label className="block text-sm text-[#086b50]">Contact Method<select className="mt-1 w-full rounded-lg border border-[#bfd4fa] bg-white px-3 py-2.5 text-sm"><option>Phone</option><option>Email</option><option>Video Call</option></select></label><label className="mt-3 block text-sm text-[#086b50]">Follow-up Date<input type="date" className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-sm" /></label><label className="mt-3 block text-sm text-[#086b50]">Contact Notes<textarea value={contactNotes} onChange={event => setContactNotes(event.target.value)} placeholder="Details of the conversation..." className="mt-1 h-20 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-sm" /></label></div>}
              {mode === 'schedule' && <div className="rounded-xl border border-[#82b5ff] bg-[#f0f7ff] p-4"><h3 className="mb-3 text-sm font-semibold text-[#086b50]">Schedule Demo Form</h3><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><label className="text-sm text-[#086b50]">Demo Date<input type="date" value={scheduleForm.date} onChange={event => setScheduleForm({ ...scheduleForm, date: event.target.value })} className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-sm" /></label><label className="text-sm text-[#086b50]">Demo Time<input type="time" value={scheduleForm.time} onChange={event => setScheduleForm({ ...scheduleForm, time: event.target.value })} className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-sm" /></label><label className="text-sm text-[#086b50]">Assigned Representative<input value={scheduleForm.representative} onChange={event => setScheduleForm({ ...scheduleForm, representative: event.target.value })} placeholder="e.g. John Cruz" className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-sm" /></label><label className="text-sm text-[#086b50]">Meeting Link<input value={scheduleForm.link} onChange={event => setScheduleForm({ ...scheduleForm, link: event.target.value })} placeholder="https://meet.google.com/..." className="mt-1 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-sm" /></label></div><label className="mt-3 block text-sm text-[#086b50]">Additional Notes<textarea value={scheduleForm.notes} onChange={event => setScheduleForm({ ...scheduleForm, notes: event.target.value })} placeholder="Any notes for the demo..." className="mt-1 h-16 w-full rounded-lg border border-[#bfd4fa] px-3 py-2.5 text-sm" /></label></div>}
              {mode === 'view' && <div className="flex flex-wrap gap-2">{selected.status === 'New' && <><button onClick={() => setMode('contact')} className="rounded-lg bg-[#7c3aed] px-4 py-2.5 text-sm font-semibold text-white">Record Contact</button><button onClick={() => setMode('schedule')} className="rounded-lg bg-[#086b50] px-4 py-2.5 text-sm font-semibold text-white">Schedule Demo</button><button onClick={() => updateStatus('Cancelled', `${selected.clinic} demo request cancelled.`, 'error')} className="rounded-lg bg-[#e52d2d] px-4 py-2.5 text-sm font-semibold text-white">Cancel</button></>}{selected.status === 'Contacted' && <><button onClick={() => setMode('schedule')} className="rounded-lg bg-[#086b50] px-4 py-2.5 text-sm font-semibold text-white">Schedule Demo</button><button onClick={() => updateStatus('Completed', `${selected.clinic} demo marked as Completed.`)} className="rounded-lg bg-[#079669] px-4 py-2.5 text-sm font-semibold text-white">Mark Completed</button></>}{selected.status === 'Scheduled' && <button onClick={() => updateStatus('Completed', `${selected.clinic} demo marked as Completed.`)} className="rounded-lg bg-[#079669] px-4 py-2.5 text-sm font-semibold text-white">Mark Completed</button>}</div>}
              {mode !== 'view' && <div className="flex gap-3"><button onClick={() => mode === 'contact' ? updateStatus('Contacted', `${selected.clinic} marked as Contacted. Notification sent.`) : updateStatus('Scheduled', `Demo scheduled for ${selected.clinic}. Notification sent to clinic.`)} className="rounded-lg bg-[#086b50] px-4 py-2.5 text-sm font-semibold text-white">{mode === 'contact' ? 'Save & Notify Clinic' : 'Confirm & Notify Clinic'}</button><button onClick={() => setMode('view')} className="px-3 text-sm text-[#086b50]">Back</button></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PlatformReports() {
  const [reports, setReports] = useState<[string, string, string][]>([]);
  useEffect(() => {
    apiFetch('/api/reports/platform').then(async response => {
      if (!response.ok) throw new Error('Failed to load platform reports');
      return response.json();
    }).then(data => setReports(data.reports.map((report: { label: string; value: string; description: string }) => [report.label, report.value, report.description])))
      .catch(() => setReports([]));
  }, []);
  const exportReport = () => {
    const csv = [
      ['Report', 'Value', 'Description'],
      ...reports,
    ].map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `platform-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return <div className={shell}><div className={`${card} flex flex-wrap items-end gap-3 p-3`}><Filter label="Date Range" value="Last 30 days" /><Filter label="Clinic" value="All Clinics" /><Filter label="Subscription Plan" value="All Plans" /><button onClick={exportReport} className={`${button} ml-auto bg-[#086b50] text-white`}><Download className="mr-1 inline h-3 w-3" />Export Report</button></div><div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{reports.map((report) => <div className={`${card} p-4`} key={report[0]}><p className="text-[10px] font-semibold text-[#526B62]">{report[0]}</p><p className="mt-3 text-2xl font-semibold text-[#172b24]">{report[1]}</p><p className="mt-1 text-[11px] text-[#079669]">↑ {report[2]}</p><div className="mt-4 flex h-10 items-end gap-1">{Array.from({ length: 11 }, (_, index) => <span className={`flex-1 rounded-t bg-[#d8e5fb] ${index === 10 ? 'bg-[#086b50]' : ''}`} style={{ height: `${16 + ((index * 13) % 22)}px` }} key={index} />)}</div></div>)}</div></div>;
}

export function Inbox() {
  const [selected, setSelected] = useState(0);
  const [filter, setFilter] = useState('All');
  const [reply, setReply] = useState('');
  const [messages, setMessages] = useState<string[][]>([]);
  useEffect(() => {
    apiFetch('/api/messages').then(async response => {
      if (!response.ok) throw new Error('Failed to load messages');
      return response.json();
    }).then(data => setMessages(data.map((item: any) => [
      item.sender_name || item.sender || 'Unknown', item.sender_email || item.email || '',
      item.subject || 'Message', item.audience === 'Pet Owner' || item.audience === 'pet_owner' ? 'Pet Owner' : 'Veterinary Clinic', item.body || item.message || '',
      item.created_at ? new Date(item.created_at).toLocaleDateString() : '—', String(item.id),
    ]))).catch(() => setMessages([]));
  }, []);
  const visible = messages.filter(message => filter === 'All' || message[3] === filter);
  const activeMessage = messages[selected] || ['', '', '', '', '', '', ''];
  const sendReply = () => {
    if (!reply.trim() || !activeMessage[6]) return;
    apiFetch(`/api/messages/${activeMessage[6]}/replies`, { method: 'POST', body: JSON.stringify({ body: reply.trim() }) })
      .then(async response => { if (!response.ok) throw new Error('Failed to send reply'); })
      .then(() => setReply(''));
  };
  return <div className="flex h-[calc(100vh-3.5rem)] min-h-0 flex-col overflow-hidden bg-[#fafbf8] p-5 text-sm"><div className={`${card} grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[330px_minmax(0,1fr)]`}><aside className="flex min-h-0 flex-col border-r border-[#d4e3d7]"><div className="shrink-0 border-b border-[#d4e3d7] p-4"><div className="flex justify-end"><span className="rounded-full bg-[#086b50] px-2 py-1 text-xs text-white">1</span></div><div className="relative mt-3"><Search className="absolute left-3 top-3 h-4 w-4 text-[#a9d6b7]" /><input className="w-full rounded-lg border border-[#d4e3d7] bg-[#fafbf8] py-2.5 pl-9 pr-3 text-sm" placeholder="Search messages..." /></div><div className="mt-3 flex gap-2">{['All', 'Unread', 'Clinics', 'Pet Owners'].map(item => <button onClick={() => setFilter(item === 'Unread' ? 'All' : item === 'Clinics' ? 'Veterinary Clinic' : item === 'Pet Owners' ? 'Pet Owner' : 'All')} className={`rounded-full px-3 py-1.5 text-xs font-medium ${filter === item || (item === 'All' && filter === 'All') || (item === 'Unread' && filter === 'All') ? 'bg-[#086b50] text-white' : 'bg-[#e7f4ec] text-[#526B62]'}`} key={item}>{item}</button>)}</div></div><div className="min-h-0 flex-1 overflow-y-auto">{visible.map(message => { const index = messages.indexOf(message); return <button onClick={() => setSelected(index)} className={`w-full border-b border-[#e3ecfb] p-4 text-left ${selected === index ? 'bg-[#fafbf8]' : 'bg-white'}`} key={message[0]}><div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#086b50] text-xs font-semibold text-white">{message[0].split(' ').map(word => word[0]).join('').slice(0, 2)}</span><div className="min-w-0"><div className="flex justify-between gap-2"><p className="text-sm font-bold">{message[0]}</p><span className="text-xs text-[#a9d6b7]">{message[5]}</span></div><p className="mt-1 truncate text-sm font-semibold text-[#086b50]">{message[2]}</p><p className="mt-1 truncate text-sm text-[#526B62]">{message[4]}</p><p className="mt-1 text-xs font-semibold text-[#079669]">{message[3]}</p></div></div></button>; })}</div></aside><section className="flex min-h-0 min-w-0 flex-col"><header className="flex shrink-0 items-center justify-between border-b border-[#d4e3d7] p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#086b50] text-xs font-semibold text-white">{activeMessage[0].split(' ').map(word => word[0]).join('').slice(0, 2)}</span><div><p className="text-base font-bold">{activeMessage[0]}</p><p className="text-sm font-medium text-[#086b50]">{activeMessage[1]}</p><p className="text-xs font-semibold text-[#079669]">{activeMessage[3]}</p></div></div><div className="text-right text-sm font-bold">{activeMessage[2]}<p className="mt-1 text-xs font-normal text-[#a9d6b7]">Read</p></div></header><div className="min-h-0 flex-1 overflow-y-auto bg-[#f8faff] p-6"><div className="flex gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#086b50] text-xs font-semibold text-white">DM</span><div><p className="mb-2 text-sm font-semibold text-[#a9d6b7]">{activeMessage[0]} <span className="ml-2">{activeMessage[5]}</span></p><div className="max-w-4xl rounded-xl border border-[#e3ecfb] bg-white p-4 text-sm font-semibold leading-6 text-[#3e5b8e] shadow-sm">{activeMessage[4]}</div></div></div></div><div className="flex shrink-0 gap-3 border-t border-[#d4e3d7] p-4"><input value={reply} onChange={event => setReply(event.target.value)} className="flex-1 rounded-xl border border-[#d4e3d7] px-4 py-3 text-sm" placeholder={`Reply to ${activeMessage[0]}...`} /><button onClick={sendReply} className="rounded-xl bg-[#086b50] px-4 text-white"><Send className="h-5 w-5" /></button></div></section></div></div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] text-[#a9d6b7]">{label}</p><p className="text-xs font-semibold text-[#172b24] mt-1">{value}</p></div>; }
function Filter({ label, value }: { label: string; value: string }) { return <label className="text-[10px] text-[#526B62]">{label}<span className="relative mt-1 block"><select className="min-w-32 rounded-lg border border-[#d4e3d7] bg-white px-3 py-2 text-xs text-[#172b24] appearance-none pr-7"><option>{value}</option></select><ChevronDown className="pointer-events-none absolute right-2 top-2.5 w-3 h-3" /></span></label>; }
function ReferenceTablePage({ title: _title, columns, rows, stats = [] }: { title: string; columns: string[]; rows: string[][]; stats?: string[] }) { return <div className={shell}>{stats.length > 0 && <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{stats.map((stat) => <div className={`${card} p-4 text-sm font-semibold text-[#172b24]`} key={stat}>{stat}</div>)}</div>}<div className={`${card} overflow-x-auto`}><div className="flex items-center justify-between border-b border-[#d4e3d7] p-3"><div className="relative"><Search className="absolute left-2 top-2 h-3 w-3 text-[#a9d6b7]" /><input className="w-64 rounded-lg border border-[#d4e3d7] bg-[#fafbf8] py-1.5 pl-7 text-xs" placeholder="Search..." /></div><button className={`${button} bg-[#086b50] text-white`}><Plus className="mr-1 inline h-3 w-3" />New Application</button></div><table className="w-full text-left"><thead className="bg-[#e7f4ec]"> <tr>{columns.map((column) => <th className="px-3 py-2 text-[10px] font-semibold text-[#526B62]" key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr className="border-t border-[#e3ecfb]" key={rowIndex}>{row.map((cell, cellIndex) => <td className="px-3 py-3 text-[11px] text-[#526B62]" key={cellIndex}>{cellIndex === row.length - 1 ? <span className="rounded-full bg-[#e7f4ec] px-2 py-1 text-[#086b50]">{cell}</span> : cell}</td>)}</tr>)}</tbody></table></div></div>; }
