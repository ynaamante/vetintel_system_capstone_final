import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

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

      <section className="relative isolate mb-3 flex min-h-[78px] items-center justify-between overflow-hidden rounded-xl border border-[#c6e5e1] bg-gradient-to-br from-white via-[#f5fbfa] to-[#e2f4f1] px-4 py-3">
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 z-0 h-[90%] w-[28%] rounded-tl-[100%] bg-[#c9ebe5]" />
        <div className="relative z-10">
          <label className="mb-1 block text-[11px] text-[#527b79]">Filter by Clinic</label>
          <Select value={selectedClinic} onValueChange={setSelectedClinic}>
            <SelectTrigger
              className="h-9 w-fit min-w-[140px] max-w-[280px] shrink-0 rounded-full border-[#8ebfb4] bg-white px-3 text-xs font-medium text-[#173f40] shadow-none transition-colors hover:border-[#16837d] focus-visible:border-[#105f5a] focus-visible:ring-0 data-[state=open]:border-[#105f5a]"
            >
              <SelectValue className="whitespace-nowrap" />
            </SelectTrigger>
            <SelectContent className="border-[#c6e5e1] bg-white text-[#173f40]">
              <SelectItem value="All" className="focus:bg-[#e5f4f1] focus:text-[#174b4c] data-[state=checked]:bg-[#16837d] data-[state=checked]:text-white">All</SelectItem>
              {clinics.map(clinic => (
                <SelectItem key={clinic} value={clinic} className="focus:bg-[#e5f4f1] focus:text-[#174b4c] data-[state=checked]:bg-[#16837d] data-[state=checked]:text-white">
                  {clinic}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="relative z-10 inline-flex items-center rounded-full bg-[#fff4d6] px-3 py-2 text-xs font-medium text-[#a45b00]">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#df7a00]" />
          {pendingCount} pending role{pendingCount === 1 ? '' : 's'} awaiting assignment
        </p>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#c6e5e1] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-[#16837d]">
              <tr>
                {['Clinic', 'Owner', 'Requested Role', 'Users', 'Request Date', 'Status', ''].map((heading, index) => (
                  <th key={heading || `action-${index}`} className="px-4 py-3 text-sm font-semibold text-white">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(request => (
                <tr
                  key={request.id}
                  tabIndex={0}
                  aria-label={`Open role request for ${request.clinic}, ${request.role}`}
                  onClick={() => setViewingRequest(request)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setViewingRequest(request);
                    }
                  }}
                  className="cursor-pointer border-t border-[#e1efed] transition-colors hover:bg-[#f4faf9] focus-visible:bg-[#f4faf9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#16837d]"
                >
                  <td className="px-4 py-3 text-sm font-medium"><button type="button" onClick={() => setViewingRequest(request)} className="block w-full text-left">{request.clinic}</button></td>
                  <td className="px-4 py-3 text-sm text-[#526B62]"><button type="button" onClick={() => setViewingRequest(request)} className="block w-full text-left">{request.owner}</button></td>
                  <td className="px-4 py-3 text-sm"><button type="button" onClick={() => setViewingRequest(request)} className="block w-full text-left">{request.role}</button></td>
                  <td className="px-4 py-3 text-sm text-[#526B62]"><button type="button" onClick={() => setViewingRequest(request)} className="block w-full text-left">{request.users}</button></td>
                  <td className="px-4 py-3 text-sm text-[#526B62]"><button type="button" onClick={() => setViewingRequest(request)} className="block w-full text-left">{request.requestDate}</button></td>
                  <td className="px-4 py-3 text-xs font-medium"><button type="button" onClick={() => setViewingRequest(request)} className="block w-full text-left">
                    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 ${request.status === 'Assigned' ? 'bg-[#d8f7e9] text-[#078c63]' : request.status === 'Rejected' ? 'bg-[#ffe0e0] text-[#c43636]' : 'bg-[#fff1c9] text-[#c98200]'}`}>{request.status}</span>
                  </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={event => { event.stopPropagation(); setViewingRequest(request); }}
                      aria-label={`View ${request.clinic} ${request.role} request`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#16837d] transition hover:bg-[#e5f4f1]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {viewingRequest && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#173f40]/60 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="user-role-request-details-title" className="flex h-[min(560px,calc(100vh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between bg-[#16837d] px-5 py-3 text-white">
              <h2 id="user-role-request-details-title" className="text-[18px] font-semibold">Role Request Details</h2>
              <button onClick={() => setViewingRequest(null)} aria-label="Close details" className="text-xl leading-none transition hover:text-[#d4e9df]">×</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7fbfa] p-4 sm:p-5">
              <div className="space-y-4">
                <section className="overflow-hidden rounded-xl border border-[#c6e5e1] bg-white">
                  <h3 className="border-b border-[#c6e5e1] bg-[#e5f4f1] px-4 py-2.5 text-[12px] font-semibold text-[#174b4c]">Request Information</h3>
                  <dl className="grid grid-cols-1 gap-x-5 gap-y-3 p-4 text-sm sm:grid-cols-2">
                    <div><dt className="font-medium text-[#527b79]">Requested Role</dt><dd className="mt-0.5 text-[#173f40]">{viewingRequest.role}</dd></div>
                    <div><dt className="font-medium text-[#527b79]">Number of Users</dt><dd className="mt-0.5 text-[#173f40]">{viewingRequest.users} {viewingRequest.users === 1 ? 'user' : 'users'}</dd></div>
                    <div><dt className="font-medium text-[#527b79]">Clinic</dt><dd className="mt-0.5 text-[#173f40]">{viewingRequest.clinic}</dd></div>
                    <div><dt className="font-medium text-[#527b79]">Owner</dt><dd className="mt-0.5 text-[#173f40]">{viewingRequest.owner}</dd></div>
                    <div><dt className="font-medium text-[#527b79]">Request Date</dt><dd className="mt-0.5 text-[#173f40]">{viewingRequest.requestDate}</dd></div>
                    <div><dt className="font-medium text-[#526B62]">Status</dt><dd className={`mt-0.5 font-medium ${statusClass(viewingRequest.status)}`}>{viewingRequest.status}</dd></div>
                  </dl>
                </section>
                <section className="overflow-hidden rounded-xl border border-[#c6e5e1] bg-white">
                  <h3 className="border-b border-[#c6e5e1] bg-[#e5f4f1] px-4 py-2.5 text-[12px] font-semibold text-[#174b4c]">Notes</h3>
                  <p className="p-4 text-sm text-[#527b79]">{viewingRequest.notes}</p>
                </section>
                <section className="overflow-hidden rounded-xl border border-[#c6e5e1] bg-white">
                  <h3 className="border-b border-[#c6e5e1] bg-[#e5f4f1] px-4 py-2.5 text-[12px] font-semibold text-[#174b4c]">Review Guidance</h3>
                  <p className="p-4 text-sm leading-5 text-[#527b79]">
                    As Super Admin, you are responsible for reviewing and assigning the requested role to the clinic owner. The clinic owner will manage role permissions on their end.
                  </p>
                </section>
                {viewingRequest.status === 'Pending' && (
                  <section className="overflow-hidden rounded-xl border border-[#c6e5e1] bg-white">
                    <h3 className="border-b border-[#c6e5e1] bg-[#e5f4f1] px-4 py-2.5 text-sm font-semibold text-[#174b4c]">Review Actions</h3>
                    <div className="flex flex-wrap gap-2 p-4">
                      <button onClick={() => setAssignmentRequest(viewingRequest)} className="rounded-full bg-[#16837d] px-4 py-2 text-base font-semibold text-white transition hover:bg-[#105f5a]">Assign Role</button>
                      <button onClick={() => rejectRequest(viewingRequest)} className="rounded-full border border-[#c43636] bg-white px-4 py-2 text-base font-semibold text-[#c43636] transition hover:bg-[#fff1f1]">Reject</button>
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {assignmentRequest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#152744]/60 p-4">
          <div className="w-full max-w-[448px] rounded-2xl bg-white p-8 shadow-2xl">
            <h2 className="text-lg font-bold">Assign Role?</h2>
            <p className="mt-3 text-sm leading-5 text-[#526B62]">
              Assign the <strong className="text-[#086b50]">{assignmentRequest.role}</strong> role to <strong className="text-[#086b50]">{assignmentRequest.clinic}</strong>? The clinic owner will be able to create staff accounts using this role.
            </p>
            <div className="mt-6 flex gap-3">
              <button onClick={confirmAssignment} className="flex-1 rounded-lg bg-[#086b50] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#013826]">Confirm Assignment</button>
              <button onClick={() => setAssignmentRequest(null)} className="flex-1 rounded-lg bg-[#e7f4ec] px-4 py-3 text-sm text-[#086b50] transition hover:bg-[#d4e3d7]">Back</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
