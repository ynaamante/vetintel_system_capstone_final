import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import {
  Search,
  Building2,
  CheckCircle,
  Clock,
  XCircle,
  MoreVertical,
  Eye,
  CheckSquare,
  Check,
  Pause,
  PlayCircle,
  Edit,
  Users,
  X,
  Mail,
  Phone,
  MapPin,
  Plus,
  RefreshCw,
  Send,
} from 'lucide-react';
import { Toast } from '../ui/Toast';

const statusColors = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  suspended: 'bg-red-100 text-red-700',
  rejected: 'bg-red-100 text-red-700',
};

export type ClinicRecord = {
  id: number;
  name: string;
  owner: string;
  email?: string;
  ownerEmail?: string;
  phone?: string;
  address?: string;
  registrationDate: string;
  doctors: number;
  receptionists: number;
  totalStaff: number;
  status: 'active' | 'pending' | 'suspended' | 'rejected';
  application?: {
  ownerEmail?: string;
  ownerPhone?: string;
  staffCount?: number;
  requestedRoles?: Array<{ role?: string; count?: number }>;
  plan?: string;
};
};

export function ClinicManagement() {
  const [activeTab] = useState<'overview' | 'detailed'>('overview');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showActionMenu, setShowActionMenu] = useState<number | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<number | null>(null);
  const [clinics, setClinics] = useState<ClinicRecord[]>([]);
  const [editingClinic, setEditingClinic] = useState<ClinicRecord | null>(null);
  const [editForm, setEditForm] = useState({ name: '', owner: '', email: '', phone: '', address: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingClinic, setViewingClinic] = useState<ClinicRecord | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [clinicToDelete, setClinicToDelete] = useState<number | null>(null);
  const [createClinicForm, setCreateClinicForm] = useState({
    name: '',
    owner: '',
    email: '',
    phone: '',
    address: '',
    staff: '',
    plan: 'Starter',
    notes: '',
    timezone: 'UTC',
  });
  const [toast, setToast] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<'success' | 'error'>('success');
  const [approvalResult, setApprovalResult] = useState<{
    clinicName: string;
    ownerName: string;
    email: string;
    temporaryPassword: string;
    emailSent: boolean;
    warning?: string;
  } | null>(null);
  const [approvalStep, setApprovalStep] = useState<2 | 3>(2);
  const [approvalPassword, setApprovalPassword] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  const generateTemporaryPassword = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  };

  const openApprovalWizard = (clinicId: number) => {
    setSelectedClinic(clinicId);
    setApprovalPassword(generateTemporaryPassword());
    setApprovalStep(2);
    setApprovalResult(null);
    setShowApproveModal(true);
  };

  const exportToCSV = () => {
    if (clinics.length === 0) {
      setToast('No clinics to export');
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const headers = ['ID', 'Name', 'Owner', 'Email', 'Phone', 'Address', 'Status', 'Total Staff', 'Registration Date'];
    const csvContent = [
      headers.join(','),
      ...clinics.map(clinic =>
        [
          clinic.id,
          `"${clinic.name}"`,
          `"${clinic.owner}"`,
          `"${clinic.email || ''}"`,
          `"${clinic.phone || ''}"`,
          `"${clinic.address || ''}"`,
          clinic.status,
          clinic.totalStaff,
          clinic.registrationDate,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `clinic-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Log export to audit trail
    fetch('/api/clinics/export/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': localStorage.getItem('userId') || '1',
      },
      body: JSON.stringify({ format: 'CSV' }),
    }).catch((err) => console.error('Failed to log export:', err));
    
    setToast('Report exported successfully');
    setTimeout(() => setToast(null), 3000);
  };

  const exportToPDF = () => {
    if (clinics.length === 0) {
      setToast('No clinics to export');
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 30;
    const contentWidth = pageWidth - margin * 2;

    const brand: [number, number, number] = [8, 91, 166];
    const cardBg: [number, number, number] = [247, 250, 255];
    const textDark: [number, number, number] = [17, 24, 39];
    const textGray: [number, number, number] = [75, 85, 99];
    const badgeActive: [number, number, number] = [34, 197, 94];
    const badgePending: [number, number, number] = [234, 179, 8];
    const badgeSuspended: [number, number, number] = [239, 68, 68];

    const headerHeight = 128;
    doc.setFillColor(...brand);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text('VetIntel', margin, 48);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Clinic performance and status summary', margin, 68);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('Clinic Report', pageWidth - margin, 50, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(238, 242, 255);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, 68, { align: 'right' });

    const statusCounts = {
      active: clinics.filter((c) => c.status === 'active').length,
      pending: clinics.filter((c) => c.status === 'pending').length,
      suspended: clinics.filter((c) => c.status === 'suspended').length,
    };

    let y = headerHeight + 24;
    const metricBoxHeight = 66;
    const metricWidth = (contentWidth - 16) / 3;

    ['active', 'pending', 'suspended'].forEach((status, index) => {
      const x = margin + index * (metricWidth + 8);
      doc.setFillColor(...cardBg);
      doc.roundedRect(x, y, metricWidth, metricBoxHeight, 12, 12, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, y, metricWidth, metricBoxHeight, 12, 12, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(...textDark);
      doc.text(String(statusCounts[status as 'active' | 'pending' | 'suspended']), x + 14, y + 26);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...textGray);
      doc.text(`${status.charAt(0).toUpperCase() + status.slice(1)}`, x + 14, y + 44);
    });

    y += metricBoxHeight + 24;

    clinics.forEach((clinic, index) => {
      if (y + 190 > pageHeight - 80) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...textGray);
        doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, pageWidth - margin, pageHeight - 30, { align: 'right' });
        doc.addPage();
        y = margin;
      }

      const cardHeight = 178;
      doc.setFillColor(...cardBg);
      doc.roundedRect(margin, y, contentWidth, cardHeight, 16, 16, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, contentWidth, cardHeight, 16, 16, 'S');

      const titleBoxWidth = 90;
      doc.setFillColor(...brand);
      doc.roundedRect(margin + 16, y + 16, titleBoxWidth, 28, 10, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(`Clinic ${String(index + 1).padStart(2, '0')}`, margin + 16 + titleBoxWidth / 2, y + 34, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...textDark);
      doc.text(clinic.name, margin + 120, y + 34);

      const labelX = margin + 26;
      const valueX = margin + 112;
      const labelX2 = margin + contentWidth / 2 + 10;
      const valueX2 = labelX2 + 90;
      let rowY = y + 64;
      const rowGap = 18;

      const drawPair = (label: string, value: string | number, x: number, vx: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...textGray);
        doc.text(label, x, rowY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...textDark);
        doc.text(`${value}`, vx, rowY);
      };

      drawPair('ID', clinic.id, labelX, valueX);
      drawPair('Address', clinic.address || 'N/A', labelX2, valueX2);
      rowY += rowGap;
      drawPair('Owner', clinic.owner, labelX, valueX);
      drawPair('Email', clinic.email || 'N/A', labelX2, valueX2);
      rowY += rowGap;
      drawPair('Phone', clinic.phone || 'N/A', labelX, valueX);
      drawPair('Registration', clinic.registrationDate, labelX2, valueX2);
      rowY += rowGap;
      drawPair('Total Staff', clinic.totalStaff, labelX, valueX);
      drawPair('Status', clinic.status.toUpperCase(), labelX2, valueX2);

      const badgeColor = clinic.status === 'active' ? badgeActive : clinic.status === 'pending' ? badgePending : badgeSuspended;
      doc.setFillColor(...badgeColor);
      doc.roundedRect(pageWidth - margin - 104, y + 20, 88, 24, 12, 12, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(clinic.status.toUpperCase(), pageWidth - margin - 60, y + 36, { align: 'center' });

      y += cardHeight + 20;
    });

    const footerY = pageHeight - 48;
    doc.setFillColor(...brand);
    doc.rect(0, footerY, pageWidth, 48, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('www.vetintel.com', margin, footerY + 18);
    doc.text('info@vetintel.com', margin, footerY + 32);
    doc.text('123-456-7890', pageWidth - margin, footerY + 25, { align: 'right' });
    doc.setTextColor(255, 255, 255);
    doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, pageWidth - margin, footerY + 32, { align: 'right' });

    const filename = `clinic-report-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    
    // Log export to audit trail
    fetch('/api/clinics/export/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': localStorage.getItem('userId') || '1',
      },
      body: JSON.stringify({ format: 'PDF' }),
    }).catch((err) => console.error('Failed to log export:', err));
    
    setToast('Report exported successfully');
    setTimeout(() => setToast(null), 3000);
  };

  void exportToCSV;
  void exportToPDF;

  // Fetch clinics from API on mount
  useEffect(() => {
    const fetchClinics = async () => {
      try {
      const token = localStorage.getItem('vetintel_token');
      const response = await fetch('/api/clinics', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
        if (!response.ok) throw new Error('Failed to fetch clinics');
        const data = await response.json();
        // Map database clinics to component ClinicRecord type
        setClinics(data.map((clinic: any) => {
          const status = clinic.status || clinic.metadata?.status || 'active';
          return {
            id: clinic.id,
            name: clinic.name,
            owner: clinic.owner || 'Unknown',
            email: clinic.email,
            ownerEmail: clinic.metadata?.application?.ownerEmail || clinic.email,
            phone: clinic.phone,
            address: clinic.address,
            registrationDate: new Date(clinic.created_at).toLocaleDateString(),
            doctors: clinic.doctors || 0,
            receptionists: clinic.receptionists || 0,
            totalStaff: clinic.metadata?.application?.staffCount ?? clinic.total_users ?? 0,
            application: clinic.metadata?.application,
            status: (status === 'pending' ? 'pending' : status === 'suspended' ? 'suspended' : status === 'rejected' ? 'rejected' : 'active') as ClinicRecord['status'],
          };
        }));
      } catch (error) {
        console.error('Failed to fetch clinics:', error);
        setToast('Failed to load clinics');
        setTimeout(() => setToast(null), 3000);
      }
    };

    fetchClinics();
  }, []);

  function openEditModal(clinic: ClinicRecord) {
    setEditForm({ name: clinic.name, owner: clinic.owner, email: clinic.email ?? '', phone: clinic.phone ?? '', address: clinic.address ?? '' });
    setEditingClinic(clinic);
    setShowActionMenu(null);
  }

  async function saveEdit() {
    if (!editingClinic) return;

    try {
      const token = localStorage.getItem('vetintel_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`/api/clinics/${editingClinic.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: editForm.name,
          owner: editForm.owner,
          email: editForm.email,
          phone: editForm.phone,
          address: editForm.address,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setToast(errorData.error || 'Failed to update clinic');
        setTimeout(() => setToast(null), 3000);
        return;
      }

      const updatedClinic = await response.json();
      setClinics(prev => prev.map(c =>
        c.id === updatedClinic.id
          ? {
              ...c,
              name: updatedClinic.name,
              owner: updatedClinic.owner || c.owner,
              email: updatedClinic.email,
              phone: updatedClinic.phone,
              address: updatedClinic.address,
              status: updatedClinic.status || c.status,
            }
          : c
      ));
      setEditingClinic(null);
      setToast('Clinic information updated successfully.');
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Failed to update clinic:', error);
      setToast('Failed to update clinic');
      setTimeout(() => setToast(null), 3000);
    }
  }

  const filteredClinics = clinics.filter((clinic) => {
    const matchesStatus =
      selectedStatus === 'all' || clinic.status === selectedStatus;
    const matchesSearch =
      clinic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clinic.owner.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });
  const approvalClinic = clinics.find(clinic => clinic.id === selectedClinic);

  const handleApprove = async () => {
    if (!selectedClinic) return;

    try {
      setIsApproving(true);
      const token = localStorage.getItem('vetintel_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`/api/clinics/${selectedClinic}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: 'active', temporaryPassword: approvalPassword }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setToast(errorData.error || 'Failed to approve clinic');
        setTimeout(() => setToast(null), 3000);
        return;
      }

      const updatedClinic = await response.json();
      setClinics((prev) => prev.map((clinic) =>
        clinic.id === updatedClinic.id
          ? { ...clinic, status: updatedClinic.status || 'active' }
          : clinic
      ));
      setSelectedClinic(null);
      const credentials = updatedClinic.ownerCredentials;
      if (credentials) {
        setApprovalResult({
          clinicName: updatedClinic.name,
          ownerName: updatedClinic.owner || 'Clinic Owner',
          email: credentials.email,
          temporaryPassword: credentials.temporaryPassword || approvalPassword,
          emailSent: credentials.emailSent === true,
          warning: credentials.emailDeliveryWarning,
        });
      }
      setShowApproveModal(false);
      setApprovalStep(3);
      setToast(credentials?.emailSent ? 'Clinic approved and owner account email sent.' : 'Clinic approval completed.');
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Failed to approve clinic:', error);
      setToast('Failed to approve clinic');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsApproving(false);
    }
  };

  const handleSuspend = async () => {
    if (!selectedClinic) return;

    try {
      const token = localStorage.getItem('vetintel_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`/api/clinics/${selectedClinic}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: 'suspended' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setToast(errorData.error || 'Failed to suspend clinic');
        setTimeout(() => setToast(null), 3000);
        return;
      }

      const updatedClinic = await response.json();
      setClinics((prev) => prev.map((clinic) =>
        clinic.id === updatedClinic.id
          ? { ...clinic, status: updatedClinic.status || 'suspended' }
          : clinic
      ));
      setShowSuspendModal(false);
      setSelectedClinic(null);
      setToast('Clinic suspended successfully');
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Failed to suspend clinic:', error);
      setToast('Failed to suspend clinic');
      setTimeout(() => setToast(null), 3000);
    }
  };

  const rejectApplication = async (clinic: ClinicRecord) => {
    try {
      const token = localStorage.getItem('vetintel_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;

      const response = await fetch(`/api/clinics/${clinic.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: 'rejected' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setToastVariant('error');
        setToast(errorData.error || 'Failed to reject application');
        setTimeout(() => setToast(null), 3000);
        return;
      }

      const updatedClinic = await response.json();
      setClinics((prev) => prev.map((item) =>
        item.id === clinic.id ? { ...item, status: updatedClinic.status || 'rejected' } : item
      ));
      setViewingClinic(null);
      setToastVariant('error');
      setToast(`Application for ${clinic.name} has been rejected.`);
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Failed to reject application:', error);
      setToastVariant('error');
      setToast('Failed to reject application');
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleReactivate = async (clinicId: number) => {
    try {
      const token = localStorage.getItem('vetintel_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`/api/clinics/${clinicId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: 'active' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setToast(errorData.error || 'Failed to reactivate clinic');
        setTimeout(() => setToast(null), 3000);
        return;
      }

      const updatedClinic = await response.json();
      setClinics((prev) => prev.map((clinic) =>
        clinic.id === updatedClinic.id
          ? { ...clinic, status: updatedClinic.status || 'active' }
          : clinic
      ));
      setToast('Clinic reactivated successfully');
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Failed to reactivate clinic:', error);
      setToast('Failed to reactivate clinic');
      setTimeout(() => setToast(null), 3000);
    }
  };

  async function handleCreateClinic() {
    if (!createClinicForm.name.trim()) {
      setToast('Clinic name is required');
      setTimeout(() => setToast(null), 3000);
      return;
    }

    try {
      const token = localStorage.getItem('vetintel_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch('/api/clinics', {
        method: 'POST',
        headers,
        body: JSON.stringify(createClinicForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setToast(errorData.error || 'Failed to add clinic');
        setTimeout(() => setToast(null), 3000);
        return;
      }

      const newClinic = await response.json();
      setClinics(prev => [
        {
          id: newClinic.id,
          name: newClinic.name,
          owner: newClinic.owner || 'Unknown',
          email: newClinic.email,
          phone: newClinic.phone,
          address: newClinic.address,
          registrationDate: new Date(newClinic.created_at).toLocaleDateString(),
          doctors: 0,
          receptionists: 0,
          totalStaff: 0,
          status: (newClinic.status || 'active') as ClinicRecord['status'],
        },
        ...prev,
      ]);
      setCreateClinicForm({ name: '', owner: '', email: '', phone: '', address: '', staff: '', plan: 'Starter', notes: '', timezone: 'UTC' });
      setShowCreateModal(false);
      setToast('Clinic added successfully');
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Failed to create clinic:', error);
      setToast('Failed to add clinic');
      setTimeout(() => setToast(null), 3000);
    }
  }

  const handleDeleteClinic = async () => {
    if (!clinicToDelete) return;
    try {
      const token = localStorage.getItem('vetintel_token');
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`/api/clinics/${clinicToDelete}`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        setToast(err?.error || 'Failed to archive clinic');
        setTimeout(() => setToast(null), 3000);
        return;
      }

      setClinics((prev) => prev.filter((c) => c.id !== clinicToDelete));
      setClinicToDelete(null);
      setShowDeleteConfirm(false);
      setToast('Clinic archived successfully');
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Failed to delete clinic:', error);
      setToast('Failed to delete clinic');
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="p-5 space-y-5 bg-[#fafbf8] min-h-full">
      <div className="bg-white rounded-lg border border-[#d4e3d7] overflow-hidden">
        <div className="flex items-center gap-7 px-4 border-b border-[#d4e3d7] overflow-x-auto">
          {[
            ['all', 'All', clinics.length],
            ['pending', 'Pending', clinics.filter((clinic) => clinic.status === 'pending').length],
            ['under_review', 'Under Review', 1],
            ['active', 'Approved', clinics.filter((clinic) => clinic.status === 'active').length],
            ['rejected', 'Rejected', 1],
            ['needs_information', 'Needs Information', 1],
          ].map(([value, label, count]) => (
            <button
              key={value}
              onClick={() => setSelectedStatus(value as string)}
              className={`flex items-center gap-1.5 py-3 text-xs whitespace-nowrap border-b-2 ${selectedStatus === value ? 'border-[#086b50] text-[#086b50]' : 'border-transparent text-[#526B62]'}`}
            >
              {label}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${selectedStatus === value ? 'bg-[#086b50] text-white' : 'bg-[#e7f4ec] text-[#526B62]'}`}>{count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 p-3 border-b border-[#d4e3d7]">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-[#a9d6b7]" />
            <input type="text" placeholder="Search clinics..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full rounded-lg border border-[#d4e3d7] bg-[#fafbf8] pl-8 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#086b50]" />
          </div>
          <button onClick={() => setShowCreateModal(true)} className="rounded-lg bg-[#086b50] px-4 py-2 text-xs font-semibold text-white"><Plus className="inline w-3.5 h-3.5 mr-1" />New Application</button>
        </div>
      </div>

      {/* Clinics Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Clinics Overview Table */}
          <div className="bg-white rounded-lg border border-[#d4e3d7] overflow-visible">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#e7f4ec] border-b border-[#d4e3d7]">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#526B62]">
                      Clinic Name
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#526B62]">
                      Owner Name
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#526B62]">
                      Contact Email
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#526B62]">
                      Staff Req.
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#526B62]">Plan</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#526B62]">Type</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#526B62]">Submitted</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#526B62]">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#526B62]"> </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#e3ecfb]">
                  {filteredClinics.map((clinic) => (
                    <tr key={clinic.id} className="hover:bg-[#f8faff]">
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-[#172b24]">
                        <Link
                          to={`/clinics/${clinic.id}`}
                          className="hover:text-[#086b50]"
                        >
                          {clinic.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-[#526B62]">
                        {clinic.owner}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-[#526B62]">
                        {clinic.email || '—'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-[#526B62]">
                        {clinic.totalStaff}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-[#526B62]">
                     {clinic.application?.plan || 'Starter'}
                    </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-[#526B62]">New Registration</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-[#526B62]">
                        {new Date(clinic.registrationDate).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            clinic.status === 'active' ? 'bg-[#d8f7e9] text-[#078c63]' : clinic.status === 'pending' ? 'bg-[#fff1c9] text-[#c98200]' : 'bg-[#ffe0e0] text-[#c43636]'
                          }`}
                        >
                          {clinic.status === 'active' ? 'Approved' : clinic.status === 'pending' ? 'Pending' : 'Rejected'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => setViewingClinic(clinic)}
                          className="rounded-lg bg-[#e7f4ec] px-3 py-1 text-sm text-[#086b50] transition hover:bg-[#d4e3d7]"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Detailed View Tab */}
      {activeTab === 'detailed' && (
        <>
          {/* Filters and Search */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by clinic name or owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedStatus('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                selectedStatus === 'all'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({clinics.length})
            </button>
            <button
              onClick={() => setSelectedStatus('active')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                selectedStatus === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setSelectedStatus('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                selectedStatus === 'pending'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setSelectedStatus('suspended')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                selectedStatus === 'suspended'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Suspended
            </button>
          </div>
        </div>
      </div>

      {/* Clinics Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Clinic Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Clinic Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registration Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Doctors
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Receptionists
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Staff
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClinics.map((clinic) => (
                <tr key={clinic.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-blue-700" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {clinic.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {clinic.owner}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(clinic.registrationDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {clinic.doctors}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {clinic.receptionists}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {clinic.totalStaff}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        statusColors[clinic.status]
                      }`}
                    >
                      {clinic.status.charAt(0).toUpperCase() +
                        clinic.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="relative inline-block text-left">
                        <button
                          onClick={() => setShowActionMenu(showActionMenu === clinic.id ? null : clinic.id)}
                          className="text-gray-400 hover:text-gray-600 focus:outline-none"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        {showActionMenu === clinic.id && (
                          <div className="absolute right-0 top-full mt-2 min-w-[12rem] bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                              <Link
                                to={`/clinics/${clinic.id}`}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                onClick={() => setShowActionMenu(null)}
                              >
                                <Eye className="w-4 h-4" />
                                View Details
                              </Link>
                              {clinic.status === 'pending' && (
                                <button
                                  onClick={() => {
                                    openApprovalWizard(clinic.id);
                                    setShowActionMenu(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <CheckSquare className="w-4 h-4" />
                                  Approve Clinic
                                </button>
                              )}
                              {clinic.status === 'active' && (
                                <button
                                  onClick={() => {
                                    setSelectedClinic(clinic.id);
                                    setShowSuspendModal(true);
                                    setShowActionMenu(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <Pause className="w-4 h-4" />
                                  Suspend Clinic
                                </button>
                              )}
                              {clinic.status === 'suspended' && (
                                <button
                                  onClick={() => {
                                    handleReactivate(clinic.id);
                                    setShowActionMenu(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <PlayCircle className="w-4 h-4" />
                                  Reactivate Clinic
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  openEditModal(clinic);
                                  setShowActionMenu(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <Edit className="w-4 h-4" />
                                Edit Information
                              </button>
                              <button
                                onClick={() => {
                                  setClinicToDelete(clinic.id);
                                  setShowDeleteConfirm(true);
                                  setShowActionMenu(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                              >
                                <X className="w-4 h-4" />
                                Delete Clinic
                              </button>
                            </div>
                        )}
                      </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* Toast */}
      {toast && <Toast message={toast} variant={toastVariant} onClose={() => setToast(null)} />}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && clinicToDelete !== null && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 text-center">Archive Clinic</h2>
              <p className="text-sm text-gray-600 text-center mt-2">Are you sure you want to archive this clinic? Archived clinics are hidden from lists.</p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setClinicToDelete(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteClinic}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Clinic Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#152744]/60 p-4">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#d8e3f8] px-6 py-5">
              <h2 className="text-lg font-bold text-[#172b24]">New Clinic Application</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#4870ba] transition hover:text-[#086b50]"
                aria-label="Close new clinic application"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <section>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#086b50]">Clinic Information</h3>
                <label className="mb-1.5 block text-sm font-medium text-[#46649a]">Clinic Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={createClinicForm.name}
                  onChange={e => setCreateClinicForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-xl border border-[#bcd2fb] px-4 py-2.5 text-base text-[#172b24] placeholder:text-[#8b9bb8] focus:border-[#086b50] focus:outline-none focus:ring-2 focus:ring-[#086b50]/15"
                  placeholder="e.g. Sunrise Veterinary Clinic"
                />
                <label className="mb-1.5 mt-4 block text-sm font-medium text-[#46649a]">Clinic Address <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={createClinicForm.address}
                  onChange={e => setCreateClinicForm(p => ({ ...p, address: e.target.value }))}
                  className="w-full rounded-xl border border-[#bcd2fb] px-4 py-2.5 text-base text-[#172b24] placeholder:text-[#8b9bb8] focus:border-[#086b50] focus:outline-none focus:ring-2 focus:ring-[#086b50]/15"
                  placeholder="Street, City, Province"
                />
              </section>

              <section>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#086b50]">Owner / Contact Information</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#46649a]">Owner Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={createClinicForm.owner}
                      onChange={e => setCreateClinicForm(p => ({ ...p, owner: e.target.value }))}
                      className="w-full rounded-xl border border-[#bcd2fb] px-4 py-2.5 text-base text-[#172b24] placeholder:text-[#8b9bb8] focus:border-[#086b50] focus:outline-none focus:ring-2 focus:ring-[#086b50]/15"
                      placeholder="Dr. Full Name"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#46649a]">Email Address <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      value={createClinicForm.email}
                      onChange={e => setCreateClinicForm(p => ({ ...p, email: e.target.value }))}
                      className="w-full rounded-xl border border-[#bcd2fb] px-4 py-2.5 text-base text-[#172b24] placeholder:text-[#8b9bb8] focus:border-[#086b50] focus:outline-none focus:ring-2 focus:ring-[#086b50]/15"
                      placeholder="owner@clinic.com"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#46649a]">Phone Number</label>
                    <input
                      type="text"
                      value={createClinicForm.phone}
                      onChange={e => setCreateClinicForm(p => ({ ...p, phone: e.target.value }))}
                      className="w-full rounded-xl border border-[#bcd2fb] px-4 py-2.5 text-base text-[#172b24] placeholder:text-[#8b9bb8] focus:border-[#086b50] focus:outline-none focus:ring-2 focus:ring-[#086b50]/15"
                      placeholder="+63 9XX XXX XXXX"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#46649a]">Number of Staff</label>
                    <input
                      type="number"
                      min="0"
                      value={createClinicForm.staff}
                      onChange={e => setCreateClinicForm(p => ({ ...p, staff: e.target.value }))}
                      className="w-full rounded-xl border border-[#bcd2fb] px-4 py-2.5 text-base text-[#172b24] placeholder:text-[#8b9bb8] focus:border-[#086b50] focus:outline-none focus:ring-2 focus:ring-[#086b50]/15"
                      placeholder="e.g. 5"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#086b50]">Subscription Plan</h3>
                <label className="mb-1.5 block text-sm font-medium text-[#46649a]">Select Plan</label>
                <select
                  value={createClinicForm.plan}
                  onChange={e => setCreateClinicForm(p => ({ ...p, plan: e.target.value }))}
                  className="w-full rounded-xl border border-[#bcd2fb] bg-white px-4 py-2.5 text-base text-[#172b24] focus:border-[#086b50] focus:outline-none focus:ring-2 focus:ring-[#086b50]/15"
                >
                  <option>Starter</option>
                  <option>Professional</option>
                  <option>Enterprise</option>
                </select>
                <label className="mb-1.5 mt-4 block text-sm font-medium text-[#46649a]">Additional Notes</label>
                <textarea
                  rows={3}
                  value={createClinicForm.notes}
                  onChange={e => setCreateClinicForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full resize-none rounded-xl border border-[#bcd2fb] px-4 py-2.5 text-base text-[#172b24] placeholder:text-[#8b9bb8] focus:border-[#086b50] focus:outline-none focus:ring-2 focus:ring-[#086b50]/15"
                  placeholder="Any additional information about this clinic..."
                />
              </section>
            </div>

            <div className="flex items-center gap-7 px-6 pb-6">
              <button onClick={handleCreateClinic} className="rounded-xl bg-[#086b50] px-5 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#174fc5]">
                Submit Application
              </button>
              <button onClick={() => setShowCreateModal(false)} className="text-base font-medium text-[#315eb4] hover:text-[#086b50]">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Application details modal */}
      {viewingClinic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#152744]/60 p-4">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#d8e3f8] px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-[#172b24]">{viewingClinic.name}</h2>
                <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  viewingClinic.status === 'active'
                    ? 'bg-[#d8f7e9] text-[#078c63]'
                    : viewingClinic.status === 'pending'
                      ? 'bg-[#fff1c9] text-[#c98200]'
                      : 'bg-[#ffe0e0] text-[#c43636]'
                }`}>
                  {viewingClinic.status === 'active' ? 'Approved' : viewingClinic.status === 'pending' ? 'Pending' : 'Rejected'}
                </span>
              </div>
              <button
                onClick={() => setViewingClinic(null)}
                className="text-[#4870ba] transition hover:text-[#086b50]"
                aria-label="Close application details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <section className="rounded-xl bg-[#eef4ff] p-4">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#086b50]">Clinic Information</h3>
                  <div className="space-y-2 text-sm text-[#172b24]">
                    <p><strong>Clinic Name:</strong> <span className="text-[#526B62]">{viewingClinic.name}</span></p>
                    <p><strong>Address:</strong> <span className="text-[#526B62]">{viewingClinic.address || '123 Katipunan Ave, Quezon City'}</span></p>
                    <p><strong>Contact Email:</strong> <span className="text-[#526B62]">{viewingClinic.email || '—'}</span></p>
                    <p><strong>Phone:</strong> <span className="text-[#526B62]">{viewingClinic.phone || '—'}</span></p>
                  </div>
                </section>
                <section className="rounded-xl bg-[#eef4ff] p-4">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#086b50]">Owner Information</h3>
                  <div className="space-y-2 text-sm text-[#172b24]">
                    <p><strong>Owner Name:</strong> <span className="text-[#526B62]">{viewingClinic.owner}</span></p>
                    <p><strong>Email:</strong> <span className="text-[#526B62]">{viewingClinic.ownerEmail || viewingClinic.application?.ownerEmail || '—'}</span></p>
                    <p><strong>Phone:</strong> <span className="text-[#526B62]">{viewingClinic.application?.ownerPhone || '—'}</span></p>
                    <p><strong>Position:</strong> <span className="text-[#526B62]">Clinic Owner</span></p>
                  </div>
                </section>
              </div>

              <section className="rounded-xl bg-[#eef4ff] p-4">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#086b50]">Requested Staff Structure</h3>
                <div className="space-y-2">
                 {(viewingClinic.application?.requestedRoles || []).map(({ role, count }) => (
                    <div key={role} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm text-[#172b24]">
                      <span>{role || 'Unspecified role'}</span>
                      <span className="rounded-full bg-[#e7f4ec] px-2 py-1 text-xs text-[#086b50]">
                      {count || 0} {count === 1 ? 'user' : 'users'} </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl bg-[#eef4ff] p-4">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#086b50]">Subscription</h3>
                <div className="grid grid-cols-1 gap-2 text-sm text-[#172b24] md:grid-cols-2">
                  <p><strong>Plan:</strong> <span className="text-[#526B62]">{viewingClinic.application?.plan || 'Starter'}</span></p>
                  <p><strong>Billing:</strong> <span className="text-[#526B62]">Monthly</span></p>
                  <p><strong>Staff Slots:</strong> <span className="text-[#526B62]">{viewingClinic.application?.staffCount ?? viewingClinic.totalStaff}</span></p>
                  <p><strong>Submitted:</strong> <span className="text-[#526B62]">{viewingClinic.registrationDate}</span></p>
                </div>
              </section>
            </div>

            <div className="flex flex-wrap gap-2 px-6 pb-6">
              <button
                onClick={() => {
                  openApprovalWizard(viewingClinic.id);
                  setViewingClinic(null);
                }}
                className="rounded-xl bg-[#08a36f] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#078c63]"
              >
                Approve Application
              </button>
              <button
                onClick={() => {
                  void rejectApplication(viewingClinic);
                }}
                className="rounded-xl bg-[#ef252b] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#d91e23]"
              >
                Reject Application
              </button>
              <button
                onClick={() => {
                  setViewingClinic(null);
                  setToast('Information request action is ready for backend integration');
                  setTimeout(() => setToast(null), 3000);
                }}
                className="rounded-xl bg-[#e7f4ec] px-4 py-2.5 text-sm font-bold text-[#086b50] hover:bg-[#d4e3d7]"
              >
                Request Information
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Information Modal */}
      {editingClinic && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Edit className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Edit Clinic Information</h2>
              </div>
              <button onClick={() => setEditingClinic(null)} className="text-gray-400 hover:text-gray-600">
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
                onClick={() => setEditingClinic(null)}
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

      {/* Create owner account wizard */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#152744]/60 p-4">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="px-6 pb-5 pt-6">
              <div className="mb-6 flex items-center justify-center gap-3 text-xs font-medium">
                <div className="flex items-center gap-2 text-[#079669]"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#079669] text-white"><Check className="h-4 w-4" /></span>Review</div>
                <span className="h-px w-16 bg-[#079669]" />
                <div className={`flex items-center gap-2 ${approvalStep === 2 ? 'text-[#086b50]' : 'text-[#079669]'}`}><span className={`flex h-7 w-7 items-center justify-center rounded-full text-white ${approvalStep === 2 ? 'bg-[#086b50]' : 'bg-[#079669]'}`}>{approvalStep === 2 ? '2' : <Check className="h-4 w-4" />}</span>Create Account</div>
                <span className={`h-px w-16 ${approvalStep === 3 ? 'bg-[#079669]' : 'bg-[#d6e3fb]'}`} />
                <div className={`flex items-center gap-2 ${approvalStep === 3 ? 'text-[#086b50]' : 'text-[#9bb1d8]'}`}><span className={`flex h-7 w-7 items-center justify-center rounded-full ${approvalStep === 3 ? 'bg-[#086b50] text-white' : 'bg-[#e7f4ec] text-[#9bb1d8]'}`}>3</span>Credentials Sent</div>
              </div>

              {approvalStep === 2 && approvalClinic && (
                <>
                  <div className="mb-5 flex items-center justify-between">
                    <div><h2 className="text-lg font-bold text-[#172b24]">Create Clinic Owner Account</h2><p className="text-sm text-[#526B62]">{approvalClinic.name} · {approvalClinic.owner}</p></div>
                    <button onClick={() => setShowApproveModal(false)} className="text-[#526B62] hover:text-[#086b50]" aria-label="Close"><X className="h-5 w-5" /></button>
                  </div>
                  <div className="mb-5 flex items-center gap-3 rounded-xl bg-[#eef4ff] p-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#086b50] text-sm font-bold text-white">{approvalClinic.owner.split(' ').map(word => word[0]).join('').slice(0, 2)}</span><div><p className="font-bold text-[#172b24]">{approvalClinic.owner}</p><p className="text-sm text-[#526B62]">Clinic Owner · {approvalClinic.name}</p></div><span className="ml-auto rounded-full bg-[#d1fae5] px-3 py-1 text-xs font-semibold text-[#079669]">Approved</span></div>
                  <label className="mb-1.5 block text-sm font-medium text-[#526B62]">Login Email <span className="text-red-500">*</span></label>
                  <input value={approvalClinic.ownerEmail || approvalClinic.email || ''} readOnly className="mb-1 w-full rounded-xl border border-[#bcd2fb] bg-white px-4 py-2.5 text-sm text-[#172b24]" />
                  <p className="mb-4 text-xs text-[#8aa4d2]">Pre-filled from the application. Update if needed.</p>
                  <div className="mb-1.5 flex items-center justify-between"><label className="text-sm font-medium text-[#526B62]">Temporary Password <span className="text-red-500">*</span></label><button onClick={() => setApprovalPassword(generateTemporaryPassword())} className="flex items-center gap-1 text-sm font-semibold text-[#086b50]"><RefreshCw className="h-4 w-4" />Regenerate</button></div>
                  <div className="mb-4 flex gap-2"><input value={approvalPassword} onChange={event => setApprovalPassword(event.target.value)} className="w-full rounded-xl border border-[#bcd2fb] px-4 py-2.5 text-sm tracking-widest text-[#172b24]" /><button onClick={() => setApprovalPassword(generateTemporaryPassword())} className="rounded-xl bg-[#eef4ff] px-4 text-sm font-semibold text-[#086b50]">Generate</button></div>
                  <div className="overflow-hidden rounded-xl border border-[#bcd2fb]"><div className="flex items-center justify-between border-b border-[#bcd2fb] bg-[#eef4ff] px-4 py-2.5 text-sm font-semibold text-[#086b50]"><span className="flex items-center gap-2"><Mail className="h-4 w-4" />Email Preview</span><span className="font-normal text-[#8aa4d2]">Will be sent to {approvalClinic.ownerEmail || approvalClinic.email}</span></div><div className="space-y-2 p-4 text-sm text-[#3e5b8e]"><p className="font-bold text-[#172b24]">Subject: <span className="font-normal">Your VetIntel Clinic Owner Account is Ready</span></p><p>Dear <strong>{approvalClinic.owner}</strong>,</p><p>Your <strong>{approvalClinic.name}</strong> application has been approved. Here are your login credentials:</p><div className="rounded-xl bg-[#eef4ff] p-3 text-xs"><p>🌐 Platform: <strong>app.vetintel.com</strong></p><p>✉ Email: <strong>{approvalClinic.ownerEmail || approvalClinic.email}</strong></p><p>🔑 Temporary Password: <strong>{approvalPassword}</strong></p></div><p className="text-[#526B62]">Please log in and change your password on first access.</p></div></div>
                  <div className="mt-5 flex items-center gap-3"><button disabled={isApproving || !approvalPassword.trim()} onClick={handleApprove} className="flex-1 rounded-xl bg-[#086b50] px-4 py-3 text-sm font-bold text-white hover:bg-[#1853ca] disabled:cursor-not-allowed disabled:opacity-60"><span className="flex items-center justify-center gap-2"><Send className="h-4 w-4" />{isApproving ? 'Creating Account...' : 'Create Account & Send Credentials'}</span></button><button onClick={() => setShowApproveModal(false)} className="px-3 text-sm font-semibold text-[#086b50]">Back</button></div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {approvalResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#152744]/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
            <div className="mb-6 flex items-center justify-center gap-3 text-xs font-medium"><div className="flex items-center gap-2 text-[#079669]"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#079669] text-white"><Check className="h-4 w-4" /></span>Review</div><span className="h-px w-12 bg-[#079669]" /><div className="flex items-center gap-2 text-[#079669]"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#079669] text-white"><Check className="h-4 w-4" /></span>Create Account</div><span className="h-px w-12 bg-[#079669]" /><div className="flex items-center gap-2 text-[#086b50]"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#086b50] text-white">3</span>Credentials Sent</div></div>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#d1fae5] text-[#079669]"><Check className="h-8 w-8" /></div>
            <h2 className="mt-5 text-xl font-bold text-[#172b24]">Account Created!</h2>
            <p className="mt-3 text-sm leading-5 text-[#526B62]">Login credentials have been sent to <strong>{approvalResult.email}</strong>. The clinic owner can now sign in to VetIntel.</p>
            <div className="mt-5 rounded-xl bg-[#eef4ff] p-4 text-left text-sm"><p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#086b50]">Credentials Summary</p><p className="mb-2 text-[#172b24]">Clinic: <span className="text-[#526B62]">{approvalResult.clinicName}</span></p><p className="mb-2 text-[#172b24]">Owner: <span className="text-[#526B62]">{approvalResult.ownerName}</span></p><p className="mb-2 text-[#172b24]">Email: <span className="text-[#526B62]">{approvalResult.email}</span></p><p className="text-[#172b24]">Password: <code className="ml-1 rounded bg-white px-2 py-1 text-[#086b50]">{approvalResult.temporaryPassword}</code></p></div>
            <div className={`mt-4 rounded-xl border px-3 py-3 text-xs ${approvalResult.emailSent ? 'border-[#bcd2fb] bg-white text-[#526B62]' : 'border-[#f5b942] bg-[#fffaf0] text-[#9a5b00]'}`}>{approvalResult.emailSent ? 'The clinic owner will be prompted to change their password on first login.' : (approvalResult.warning || 'The account was created, but the credential email could not be sent.')}</div>
            <button onClick={() => { setApprovalResult(null); setApprovalStep(2); }} className="mt-5 w-full rounded-xl bg-[#086b50] px-4 py-3 text-sm font-bold text-white hover:bg-[#1853ca]">Go to User Role Management →</button>
            <button onClick={() => { setApprovalResult(null); setApprovalStep(2); }} className="mt-3 text-sm font-semibold text-[#526B62]">Done</button>
            </div>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <Pause className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 text-center mt-4">
                Suspend Clinic
              </h2>
              <p className="text-sm text-gray-600 text-center mt-2">
                Are you sure you want to suspend this clinic? They will lose
                access to the platform immediately.
              </p>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for suspension
                </label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Enter reason..."
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowSuspendModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSuspend}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Suspend
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
