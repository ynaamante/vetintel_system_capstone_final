import { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  Shield,
  FileText,
  Settings,
  UserCog,
  ClipboardList,
  CreditCard,
  Video,
  BarChart3,
  Inbox,
  Bell,
  Menu,
  X,
  LogOut,
  CheckCheck,
  Trash2,
  AlertCircle,
  UserPlus,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { isSystemAdmin } from '../../utils/permissionUtils';

type Notification = {
  id: number;
  type: 'alert' | 'user' | 'security' | 'info';
  title: string;
  message: string;
  time: string;
  read: boolean;
};

// TODO: Fetch from /api/notifications or WebSocket for real-time updates
const initialNotifications: Notification[] = [];

const notificationIcons: Record<Notification['type'], React.ReactNode> = {
  alert: <AlertCircle className="w-5 h-5 text-yellow-500" />,
  user: <UserPlus className="w-5 h-5 text-blue-500" />,
  security: <ShieldAlert className="w-5 h-5 text-red-500" />,
  info: <Info className="w-5 h-5 text-gray-400" />,
};

const navigation = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Clinic Applications', path: '/clinics', icon: Building2 },
  { name: 'Active Clinics', path: '/active-clinics', icon: Building2 },
  { name: 'User Role Management', path: '/users', icon: UserCog },
  { name: 'Role Requests', path: '/role-requests', icon: ClipboardList },
  { name: 'Subscription Plans', path: '/subscription-plans', icon: CreditCard },
  { name: 'Demo Requests', path: '/demo-requests', icon: Video },
  { name: 'Platform Reports', path: '/reports', icon: BarChart3 },
  { name: 'Audit Trail', path: '/audit', icon: FileText },
  { name: 'Inbox', path: '/inbox', icon: Inbox },
];

export function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');
  const [user, setUser] = useState<{ name: string; email: string; role: string; avatar?: string } | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('vetintel_token');
    if (!token) {
      navigate('/login');
      return;
    }

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    fetch(`${API_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then(data => {
        if (!isSystemAdmin(data.role)) {
          throw new Error('Unauthorized');
        }
        let storedUser: { avatar?: string; name?: string; email?: string } = {};
        try {
          storedUser = JSON.parse(localStorage.getItem('vetintel_user') || '{}');
        } catch {
          storedUser = {};
        }
        setUser({ ...data, ...storedUser });
      })
      .catch(() => {
        localStorage.removeItem('vetintel_token');
        localStorage.removeItem('vetintel_user');
        navigate('/login');
      });
  }, [navigate]);

  useEffect(() => {
    const refreshUser = () => {
      try {
        const stored = JSON.parse(localStorage.getItem('vetintel_user') || 'null');
        if (stored) setUser(prev => ({ ...prev, ...stored }));
      } catch {
        // Keep the authenticated API user when local profile data is unavailable.
      }
    };
    window.addEventListener('vetintel-user-updated', refreshUser);
    return () => window.removeEventListener('vetintel-user-updated', refreshUser);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () =>
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  const markRead = (id: number) =>
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  const deleteNotification = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const visibleNotifications = activeFilter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications;

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(regs => regs.forEach(r => r.unregister()))
        .catch(() => {});
    }
    navigate('/login');
  };

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const initials = (user.name || 'SA')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const activeNavigation = navigation.find(item =>
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path),
  );
  const pageTitle = location.pathname === '/' ? 'Dashboard Overview' : activeNavigation?.name || 'Super Admin Portal';

  return (
    <div className="flex h-screen bg-[#fafbf8] text-[#172b24]">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#081b3d]/55 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-52 bg-[#013826] border-r border-[#33755b] transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-[#33755b]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#086b50] rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-semibold text-white text-sm">VetIntel</div>
              <div className="text-[11px] text-[#bed6c5]">Super Admin</div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#0a966b] text-white'
                    : 'text-[#D2E5DC] hover:bg-[#086b50] hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#33755b] px-2 py-3">
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-[#086b50] px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#086b50]">
              {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-white">{initials}</span>}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{user.name || 'Super Admin'}</p>
              <p className="truncate text-[10px] text-[#D2E5DC]">{user.email}</p>
            </div>
          </div>
          <Link
            to="/settings"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-[#D2E5DC] hover:bg-[#086b50] hover:text-white"
          >
            <Settings className="w-4 h-4 text-[#D2E5DC]" />
            Settings
          </Link>
          <button
            onClick={handleLogout}
            className="mt-2 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-[#D2E5DC] hover:bg-[#086b50] hover:text-white"
          >
            <LogOut className="w-4 h-4 text-[#D2E5DC]" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top navigation */}
        <header className="h-14 bg-white border-b border-[#d4e3d7] flex items-center justify-between px-5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-600 hover:text-gray-900"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="text-sm font-semibold text-[#172b24]">{pageTitle}</div>

          {/* Right side actions */}
          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative text-gray-600 hover:text-gray-900"
              >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900">Notifications</h3>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          Mark all read
                        </button>
                      )}
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-gray-400 hover:text-gray-600 ml-2"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Filter tabs */}
                  <div className="flex border-b border-gray-200">
                    {(['all', 'unread'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setActiveFilter(f)}
                        className={`flex-1 py-2 text-sm capitalize ${activeFilter === f ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        {f === 'unread' ? `Unread (${unreadCount})` : 'All'}
                      </button>
                    ))}
                  </div>

                  {/* List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                    {visibleNotifications.length === 0 ? (
                      <div className="py-10 text-center text-sm text-gray-400">
                        No notifications
                      </div>
                    ) : (
                      visibleNotifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => markRead(n.id)}
                          className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${!n.read ? 'bg-blue-50/50' : ''}`}
                        >
                          <div className="mt-0.5 shrink-0">{notificationIcons[n.type]}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm ${!n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                                {n.title}
                              </p>
                              <button
                                onClick={(e) => deleteNotification(n.id, e)}
                                className="shrink-0 text-gray-300 hover:text-red-400 mt-0.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.message}</p>
                            <p className="text-xs text-gray-400 mt-1">{n.time}</p>
                          </div>
                          {!n.read && (
                            <span className="mt-1.5 shrink-0 w-2 h-2 rounded-full bg-blue-500" />
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  {notifications.length > 0 && (
                    <div className="px-4 py-2 border-t border-gray-200 text-center">
                      <button
                        onClick={() => { setNotifications([]); setShowNotifications(false); }}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        Clear all notifications
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="relative pl-4 border-l border-[#d4e3d7] hidden md:flex items-center gap-3">
              <div className="w-8 h-8 bg-[#086b50] rounded-full flex items-center justify-center">
                <span className="text-sm text-white">{initials}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
