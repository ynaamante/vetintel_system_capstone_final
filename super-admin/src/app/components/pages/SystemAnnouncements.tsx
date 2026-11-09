import { useState, useEffect } from 'react';
import { Megaphone, Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react';

const priorityColors = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
};

export function SystemAnnouncements() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState('All Clinics');
  const [priority, setPriority] = useState('low');
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setTargetAudience('All Clinics');
    setPriority('low');
    setEditingAnnouncement(null);
  };

  const fetchAnnouncements = async () => {
    try {
      const response = await fetch('/api/announcements');
      if (!response.ok) throw new Error('Failed to fetch announcements');
      const data = await response.json();
      setAnnouncements(
        (data || []).map((announcement: any) => ({
          ...announcement,
          status: announcement.active ? 'active' : 'draft',
          message: announcement.description || '',
          targetAudience: announcement.targetAudience || 'All Clinics',
          createdBy: announcement.createdBy || 'Admin',
        }))
      );
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (announcement: any) => {
    setEditingAnnouncement(announcement);
    setTitle(announcement.title || '');
    setMessage(announcement.description || '');
    setPriority(announcement.priority || 'low');
    setShowCreateModal(true);
  };

  const saveAnnouncement = async (publish: boolean) => {
    if (!title.trim()) {
      return;
    }

    try {
      const token = localStorage.getItem('vetintel_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const payload = {
        title,
        description: message,
        priority,
        active: publish,
      };

      const url = editingAnnouncement
        ? `/api/announcements/${editingAnnouncement.id}`
        : '/api/announcements';
      const method = editingAnnouncement ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('Announcement save failed:', data);
        return;
      }

      const saved = await response.json();
      const normalized = {
        ...saved,
        status: saved.active ? 'active' : 'draft',
        message: saved.description || '',
        targetAudience: editingAnnouncement ? editingAnnouncement.targetAudience || 'All Clinics' : targetAudience,
        createdBy: saved.createdBy || 'Admin',
      };

      setAnnouncements((prev) => {
        if (editingAnnouncement) {
          return prev.map((item) => (item.id === normalized.id ? normalized : item));
        }
        return [normalized, ...prev];
      });

      resetForm();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to save announcement:', error);
    }
  };

  const deleteAnnouncement = async (id: number) => {
    try {
      const token = localStorage.getItem('vetintel_token');
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('Failed to delete announcement:', data);
        return;
      }

      setAnnouncements((prev) => prev.filter((announcement) => announcement.id !== id));
    } catch (error) {
      console.error('Failed to delete announcement:', error);
    }
  };

  return (
    <div className="p-5 space-y-5 bg-[#fafbf8] min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mt-1">
            Manage platform-wide announcements and notifications
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Announcement
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">
                {announcements.length}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Megaphone className="w-6 h-6 text-blue-700" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">
                {announcements.filter((a) => a.status === 'active').length}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Eye className="w-6 h-6 text-green-700" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">High Priority</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">
                {announcements.filter((a) => a.priority === 'high').length}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <Megaphone className="w-6 h-6 text-red-700" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Drafts</p>
              <p className="text-3xl font-semibold text-gray-900 mt-2">
                {announcements.filter((a) => a.status === 'draft').length}
              </p>
            </div>
            <div className="p-3 bg-gray-100 rounded-lg">
              <EyeOff className="w-6 h-6 text-gray-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {announcements.map((announcement) => (
          <div
            key={announcement.id}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {announcement.title}
                  </h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      priorityColors[announcement.priority as keyof typeof priorityColors]
                    }`}
                  >
                    {announcement.priority.toUpperCase()}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      announcement.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {announcement.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  {announcement.message}
                </p>
                <div className="flex items-center gap-6 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4" />
                    <span>{announcement.targetAudience}</span>
                  </div>
                  <div>
                    Created by {announcement.createdBy} on{' '}
                    {new Date(announcement.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => openEditModal(announcement)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={() => deleteAnnouncement(announcement.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Announcement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Create New Announcement
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter announcement title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message
                  </label>
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter announcement message"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target Audience
                    </label>
                    <select
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option>All Clinics</option>
                      <option>Clinic Owners</option>
                      <option>Doctors</option>
                      <option>Receptionists</option>
                      <option>All Users</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(false);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveAnnouncement(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Save as Draft
                </button>
                <button
                  onClick={() => saveAnnouncement(true)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Publish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
