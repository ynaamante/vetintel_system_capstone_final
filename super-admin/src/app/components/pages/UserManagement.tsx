import { useEffect, useState } from 'react';
import { AlertCircle, Check, Eye, X } from 'lucide-react';

type RequestStatus = 'Assigned' | 'Pending' | 'Rejected';

type RoleRequest = {
  id: number;
  clinic: string;
  owner: string;
  role: string;
  users: number;
  requestDate: string;
  status: RequestStatus;
  notes: string;
};

const initialRequests: RoleRequest[] = [
  {
    id: 1,
    clinic: 'Paws & Claws Veterinary',
    owner: 'Dr. Maria Santos',
    role: 'Veterinarian',
    users: 2,
    requestDate: 'Sep 01, 2026',
    status: 'Assigned',
    notes: 'Primary attending veterinarian for all patient cases.',
  },
  {
    id: 2,
    clinic: 'Paws & Claws Veterinary',
    owner: 'Dr. Maria Santos',
    role: 'Receptionist',
    users: 2,
    requestDate: 'Sep 01, 2026',
    status: 'Pending',
    notes: 'Front desk and client scheduling support.',
  },
  {
    id: 3,
    clinic: 'Greenfield Animal Hospital',
    owner: 'Dr. James Reyes',
    role: 'Veterinarian',
    users: 2,
    requestDate: 'Aug 30, 2026',
    status: 'Assigned',
    notes: 'Veterinary care for hospital patients.',
  },
  {
    id: 4,
    clinic: 'Greenfield Animal Hospital',
    owner: 'Dr. James Reyes',
    role: 'Lab Technician',
    users: 1,
    requestDate: 'Aug 30, 2026',
    status: 'Pending',
    notes: 'In-house diagnostic lab support.',
  },
  {
    id: 5,
    clinic: 'Metro Pet Care Center',
    owner: 'Dr. Luis Tan',
    role: 'Inventory Staff',
    users: 1,
    requestDate: 'Aug 25, 2026',
    status: 'Assigned',
    notes: 'Medication and supply inventory management.',
  },
];

function statusClass(status: RequestStatus) {
  if (status === 'Assigned') return 'text-[#078c63]';
  if (status === 'Rejected') return 'text-[#c43636]';
  return 'text-[#c56a22]';
}

export function UserManagement() {
  const [requests, setRequests] = useState<RoleRequest[]>(initialRequests);
  const [selectedClinic, setSelectedClinic] = useState('All');
  const [viewingRequest, setViewingRequest] = useState<RoleRequest | null>(null);
  const [assignmentRequest, setAssignmentRequest] = useState<RoleRequest | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const clinics = Array.from(new Set(requests.map(request => request.clinic)));
  const filteredRequests = selectedClinic === 'All'
    ? requests
    : requests.filter(request => request.clinic === selectedClinic);
  const pendingCount = requests.filter(request => request.status === 'Pending').length;

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    const message = window.sessionStorage.getItem('roleManagementToast');
    if (message) {
      window.sessionStorage.removeItem('roleManagementToast');
      showToast(message, 'success');
    }
  }, []);

  function rejectRequest(request: RoleRequest) {
    setRequests(current => current.map(item => item.id === request.id ? { ...item, status: 'Rejected' } : item));
    setViewingRequest(null);
    showToast(`Role request rejected for ${request.clinic}.`, 'error');
  }

  function confirmAssignment() {
    if (!assignmentRequest) return;
    const request = assignmentRequest;
    setRequests(current => current.map(item => item.id === request.id ? { ...item, status: 'Assigned' } : item));
    setAssignmentRequest(null);
    setViewingRequest(null);
    showToast(`${request.role} role assigned to ${request.clinic}.`, 'success');
  }

  return (
    <div className="min-h-full bg-[#fafbf8] p-5 text-[#172b24]">
      {toast && (
        <div
          role="status"
          className={`fixed right-6 top-6 z-[100] flex min-h-[46px] w-[400px] max-w-[calc(100vw-3rem)] items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
            toast.type === 'success'
              ? 'border-[#42e89a] bg-[#f3fff8]'
              : 'border-[#ff8a8a] bg-[#fff5f5]'
          }`}
        >
          {toast.type === 'success'
            ? <Check className="h-4 w-4 shrink-0 text-[#079669]" />
            : <AlertCircle className="h-4 w-4 shrink-0 text-[#e52d2d]" />}
          <span>{toast.message}</span>
        </div>
      )}

      <section className="mb-3 flex min-h-[78px] items-center justify-between rounded-xl border border-[#d4e3d7] bg-white px-4 py-3">
        <div>
          <label htmlFor="clinic-filter" className="mb-1 block text-[11px] text-[#526B62]">Filter by Clinic</label>
          <select
            id="clinic-filter"
            value={selectedClinic}
            onChange={event => setSelectedClinic(event.target.value)}
            className="h-8 w-48 rounded-lg border border-[#bfd4fa] bg-white px-3 text-xs text-[#172b24] outline-none focus:ring-2 focus:ring-[#8eb5ff]"
          >
            <option value="All">All</option>
            {clinics.map(clinic => <option key={clinic} value={clinic}>{clinic}</option>)}
          </select>
        </div>
        <p className="text-xs text-[#c56a22]">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#df7a00]" />
          {pendingCount} pending role{pendingCount === 1 ? '' : 's'} awaiting assignment
        </p>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#d4e3d7] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-[#eef4ff]">
              <tr>
                {['Clinic', 'Owner', 'Requested Role', 'Users', 'Request Date', 'Status', 'Action'].map(heading => (
                  <th key={heading} className="px-4 py-3 text-[11px] font-semibold text-[#526B62]">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(request => (
                <tr key={request.id} className="border-t border-[#e3ecfb]">
                  <td className="px-4 py-3 text-sm font-medium">{request.clinic}</td>
                  <td className="px-4 py-3 text-sm text-[#526B62]">{request.owner}</td>
                  <td className="px-4 py-3 text-sm">{request.role}</td>
                  <td className="px-4 py-3 text-sm text-[#526B62]">{request.users}</td>
                  <td className="px-4 py-3 text-sm text-[#526B62]">{request.requestDate}</td>
                  <td className={`px-4 py-3 text-xs font-medium ${statusClass(request.status)}`}>{request.status}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setViewingRequest(request)}
                      className="flex items-center gap-1 rounded-lg bg-[#e7f4ec] px-3 py-1.5 text-xs font-medium text-[#086b50] hover:bg-[#dbe8ff]"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {viewingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#152744]/60 p-4">
          <div className="w-full max-w-[512px] rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#d4e3d7] px-6 py-5">
              <div>
                <h2 className="text-lg font-bold">Role Request Details</h2>
                <p className="mt-1 text-xs text-[#526B62]">{viewingRequest.clinic}</p>
              </div>
              <button onClick={() => setViewingRequest(null)} aria-label="Close details" className="text-[#086b50]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-xl bg-[#eef4ff] p-4 text-sm">
                <p>Requested Role: <span className="text-[#526B62]">{viewingRequest.role}</span></p>
                <p>Number of Users: <span className="text-[#526B62]">{viewingRequest.users} {viewingRequest.users === 1 ? 'user' : 'users'}</span></p>
                <p>Clinic: <span className="text-[#526B62]">{viewingRequest.clinic}</span></p>
                <p>Owner: <span className="text-[#526B62]">{viewingRequest.owner}</span></p>
                <p>Request Date: <span className="text-[#526B62]">{viewingRequest.requestDate}</span></p>
                <p>Status: <span className={statusClass(viewingRequest.status)}>{viewingRequest.status}</span></p>
              </div>
              <p className="rounded-xl bg-[#eef4ff] p-4 text-sm">Notes: <span className="text-[#526B62]">{viewingRequest.notes}</span></p>
              <p className="rounded-xl border border-[#82b5ff] bg-[#f0f7ff] p-4 text-xs text-[#086b50]">
                <strong>Note:</strong> As Super Admin, you are only responsible for reviewing and assigning the requested role to the clinic owner. The clinic owner will manage role permissions on their end.
              </p>
            </div>
            {viewingRequest.status === 'Pending' ? (
              <div className="flex gap-2 px-6 pb-5">
                <button onClick={() => setAssignmentRequest(viewingRequest)} className="flex-1 rounded-lg bg-[#079669] py-2.5 text-sm font-semibold text-white hover:bg-[#05845b]">Assign Role</button>
                <button onClick={() => rejectRequest(viewingRequest)} className="rounded-lg bg-[#e52d2d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#c92222]">Reject</button>
              </div>
            ) : (
              <button onClick={() => setViewingRequest(null)} className="w-full px-6 pb-5 text-sm text-[#086b50]">Close</button>
            )}
          </div>
        </div>
      )}

      {assignmentRequest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#152744]/60 p-4">
          <div className="w-full max-w-[448px] rounded-2xl bg-white p-8 shadow-2xl">
            <h2 className="text-lg font-bold">Assign Role?</h2>
            <p className="mt-3 text-sm leading-5 text-[#526B62]">
              Assign the <strong className="text-[#086b50]">{assignmentRequest.role}</strong> role to <strong className="text-[#086b50]">{assignmentRequest.clinic}</strong>? The clinic owner will be able to create staff accounts using this role.
            </p>
            <div className="mt-6 flex gap-3">
              <button onClick={confirmAssignment} className="flex-1 rounded-lg bg-[#079669] px-4 py-3 text-sm font-semibold text-white hover:bg-[#05845b]">Confirm Assignment</button>
              <button onClick={() => setAssignmentRequest(null)} className="flex-1 rounded-lg bg-[#e7f4ec] px-4 py-3 text-sm text-[#086b50] hover:bg-[#dbe8ff]">Back</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
