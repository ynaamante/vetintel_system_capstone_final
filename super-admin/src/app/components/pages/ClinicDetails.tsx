import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Users,
  CheckCircle,
  Edit,
  X,
} from 'lucide-react';

type ClinicInfo = {
  id: number;
  name: string;
  owner: string;
  email: string;
  phone: string;
  address: string;
  registrationDate: string;
  status: string;
  doctors: number;
  receptionists: number;
  totalStaff: number;
};

const initialClinicData: ClinicInfo = {
  id: 0,
  name: '',
  owner: 'Unknown',
  email: '',
  phone: '',
  address: '',
  registrationDate: new Date().toISOString(),
  status: 'active',
  doctors: 0,
  receptionists: 0,
  totalStaff: 0,
};

// staff members are loaded from /api/clinics/:id/staff
// initial empty

export function ClinicDetails() {
  const { id } = useParams();
  const [clinic, setClinic] = useState<ClinicInfo>(initialClinicData);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', owner: '', email: '', phone: '', address: '' });
  const [toast, setToast] = useState<string | null>(null);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);

  useEffect(() => {
    const loadClinic = async () => {
      if (!id) return;
      try {
        const clinicRes = await fetch(`/api/clinics/${id}`);
        if (clinicRes.ok) {
          const clinicData = await clinicRes.json();
          setClinic({
            id: clinicData.id,
            name: clinicData.name,
            owner: clinicData.owner || 'Unknown',
            email: clinicData.email || '',
            phone: clinicData.phone || '',
            address: clinicData.address || '',
            registrationDate: clinicData.created_at || new Date().toISOString(),
            status: clinicData.status || 'active',
            doctors: clinicData.doctors || 0,
            receptionists: clinicData.receptionists || 0,
            totalStaff: clinicData.totalStaff ?? clinicData.total_users ?? 0,
          });
        }
      } catch (error) {
        console.error('Failed to load clinic details:', error);
      }
    };

    loadClinic();
  }, [id]);

  useEffect(() => {
    const loadStaff = async () => {
      if (!id) return;
      try {
        const params = new URLSearchParams();
        if (roleFilter !== 'All') params.set('role', roleFilter);
        if (statusFilter !== 'All') params.set('status', statusFilter);
        const staffRes = await fetch(`/api/clinics/${id}/staff${params.toString() ? `?${params.toString()}` : ''}`);
        if (staffRes.ok) {
          const staff = await staffRes.json();
          type StaffMember = {
            id: number;
            name: string;
            email: string;
            role: string;
            status: string;
            lastLogin: string;
          };

          const normalizedStaff: StaffMember[] = staff.map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role || 'User',
            status: u.is_active ? 'Active' : 'Disabled',
            lastLogin: u.updated_at ? new Date(u.updated_at).toLocaleString() : 'Never',
          }));
          setStaffMembers(normalizedStaff);
          setAvailableRoles(
            Array.from(new Set(normalizedStaff.map(u => u.role))).filter((value): value is string => Boolean(value))
          );
        }
      } catch (error) {
        console.error('Failed to load clinic staff:', error);
      }
    };

    loadStaff();
  }, [id, roleFilter, statusFilter]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  function openEdit() {
    setEditForm({ name: clinic.name, owner: clinic.owner, email: clinic.email, phone: clinic.phone, address: clinic.address });
    setShowEditModal(true);
  }

  async function saveEdit() {
    if (!id) return;

    try {
      const token = localStorage.getItem('vetintel_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`/api/clinics/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone,
          address: editForm.address,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast(errorData.error || 'Failed to update clinic.');
        return;
      }

      const updatedClinic = await response.json();
      setClinic((prev) => ({
        ...prev,
        name: updatedClinic.name,
        email: updatedClinic.email || '',
        phone: updatedClinic.phone || '',
        address: updatedClinic.address || '',
        registrationDate: updatedClinic.created_at || prev.registrationDate,
        status: updatedClinic.status || prev.status,
      }));
      setShowEditModal(false);
      showToast('Clinic information updated successfully.');
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Failed to update clinic:', error);
      showToast('Failed to update clinic.');
    }
  }

  const profileFields = [
    { label: 'Clinic Name', value: clinic.name, icon: <Building2 className="w-6 h-6 text-blue-700" />, bg: 'bg-blue-100' },
    { label: 'Clinic Owner', value: clinic.owner, icon: <Users className="w-6 h-6 text-purple-700" />, bg: 'bg-purple-100' },
    { label: 'Email', value: clinic.email, icon: <Mail className="w-6 h-6 text-green-700" />, bg: 'bg-green-100' },
    { label: 'Phone', value: clinic.phone, icon: <Phone className="w-6 h-6 text-yellow-700" />, bg: 'bg-yellow-100' },
    { label: 'Address', value: clinic.address, icon: <MapPin className="w-6 h-6 text-red-700" />, bg: 'bg-red-100' },
    { label: 'Registration Date', value: new Date(clinic.registrationDate).toLocaleDateString(), icon: <Calendar className="w-6 h-6 text-indigo-700" />, bg: 'bg-indigo-100' },
  ];

  return (
    <div className="p-5 space-y-5 bg-[#fafbf8] min-h-full">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm bg-green-600">
          <CheckCircle className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/clinics" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-900">{clinic.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Detailed information and statistics</p>
        </div>
        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium capitalize">
          {clinic.status}
        </span>
        <button
          onClick={openEdit}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Edit className="w-4 h-4" />
          Edit Information
        </button>
      </div>

      {/* Clinic Profile */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Clinic Profile</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {profileFields.map(field => (
            <div key={field.label} className="flex items-start gap-4">
              <div className={`p-3 ${field.bg} rounded-lg shrink-0`}>{field.icon}</div>
              <div>
                <p className="text-sm text-gray-600">{field.label}</p>
                <p className="font-medium text-gray-900 mt-1">{field.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Doctors', value: clinic.doctors, icon: <Users className="w-6 h-6 text-purple-700" />, bg: 'bg-purple-100' },
          { label: 'Total Receptionists', value: clinic.receptionists, icon: <Users className="w-6 h-6 text-cyan-700" />, bg: 'bg-cyan-100' },
          { label: 'Total Staff', value: clinic.totalStaff, icon: <CheckCircle className="w-6 h-6 text-blue-700" />, bg: 'bg-blue-100' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{card.label}</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">{card.value}</p>
              </div>
              <div className={`p-3 ${card.bg} rounded-lg`}>{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Staff Members</h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <label className="text-sm text-gray-600">
                Role
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  className="ml-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>All</option>
                  {availableRoles.map(role => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-gray-600">
                Status
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="ml-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>All</option>
                  <option>Active</option>
                  <option>Disabled</option>
                </select>
              </label>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Email', 'Role', 'Status', 'Last Login'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staffMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    No staff members found for this clinic with the selected filters.
                  </td>
                </tr>
              ) : (
                staffMembers.map(staff => (
                  <tr key={staff.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-sm text-white">{staff.name
                            .split(' ')
                            .map((n: string) => n[0])
                            .join('')}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{staff.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{staff.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{staff.role}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">{staff.status}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{staff.lastLogin}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Information Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Edit className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Edit Clinic Information</h2>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clinic Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clinic Owner</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={editForm.owner}
                    onChange={e => setEditForm(p => ({ ...p, owner: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <textarea
                    rows={2}
                    value={editForm.address}
                    onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
