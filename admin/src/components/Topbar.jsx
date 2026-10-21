import { useEffect, useState } from 'react';
import { Icons } from '../icons';
import { subscribeToNotifications } from '../utils/notifications';

const INITIAL_NOTIFICATIONS = [
  { id: 1, icon: 'calendar', color: '#005447', title: 'New Appointment Request', text: 'John Smith requested an appointment for Max on July 25 at 10:00 AM — Checkup', time: '5 min ago', pet: 'Max', unread: true },
  { id: 2, icon: 'info', color: '#6366f1', title: 'New Message from Pet Owner', text: "Lisa Taylor: 'Can Dr. Smith refill Daisy's Doxycycline prescription?'", time: '12 min ago', pet: 'Daisy', unread: true },
  { id: 3, icon: 'syringe', color: '#005447', title: 'Vaccination Due Soon', text: 'Rocky (David Brown) — Rabies vaccination due in 6 days (July 28)', time: '2 hours ago', pet: 'Rocky', unread: true },
  { id: 4, icon: 'info', color: '#16a34a', title: 'Payment Received', text: "₱2,300 payment confirmed for Bella's dental cleaning (Emma Wilson)", time: '3 hours ago', pet: 'Bella', unread: false },
  { id: 5, icon: 'calendar', color: '#16a34a', title: 'Appointment Confirmed', text: 'Appointment for Max (Checkup) confirmed for July 22 at 2:00 AM with Dr. Torres', time: '4 hours ago', pet: 'Max', unread: false },
  { id: 6, icon: 'pill', color: '#f59e0b', title: 'Low Stock Alert', text: 'Amoxicillin 50mg is below its reorder level.', time: 'Yesterday', pet: '', unread: false },
  { id: 7, icon: 'refresh', color: '#0891b2', title: 'Data Sync Completed', text: '47 records were synchronized with the intelligence network.', time: 'Yesterday', pet: '', unread: false },
  { id: 8, icon: 'settings', color: '#64748b', title: 'System Settings Updated', text: 'Privacy settings for data sharing were updated.', time: '2 days ago', pet: '', unread: false },
];

export default function Topbar({ user, title, subtitle, actions, headerContent, className = '' }) {
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('vetintel_notifications') || 'null');
      return Array.isArray(saved) ? saved : INITIAL_NOTIFICATIONS;
    } catch {
      return INITIAL_NOTIFICATIONS;
    }
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const unreadCount = notifications.filter(notification => notification.unread).length;
  const visibleNotifications = (unreadOnly
    ? notifications.filter(notification => notification.unread)
    : notifications
  ).slice(0, showAll ? notifications.length : 5);

  useEffect(() => subscribeToNotifications(notification => {
    setNotifications(current => {
      const next = [notification, ...current].slice(0, 50);
      localStorage.setItem('vetintel_notifications', JSON.stringify(next));
      return next;
    });
  }), []);

  const markRead = id => {
    setNotifications(current => {
      const next = current.map(notification => (
      notification.id === id ? { ...notification, unread: false } : notification
      ));
      localStorage.setItem('vetintel_notifications', JSON.stringify(next));
      return next;
    });
  };

  const markAllRead = () => {
    setNotifications(current => {
      const next = current.map(notification => ({ ...notification, unread: false }));
      localStorage.setItem('vetintel_notifications', JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className={className} style={s.bar}>
      <div>
        {headerContent || (
          <>
            <h2 style={s.title}>{title}</h2>
            <p style={s.subtitle}>{subtitle}</p>
          </>
        )}
      </div>

      <div style={s.right}>
        {actions}
        <button type="button" style={{ ...s.notif, ...(showNotifications ? s.notifActive : {}) }} onClick={() => setShowNotifications(current => !current)} aria-label="Open notifications">
          <span style={s.notifIcon}>{Icons.bell}</span>
          {unreadCount > 0 && <span style={s.pip} />}
        </button>

        {showNotifications && (
          <div style={s.notificationPanel}>
            <div style={s.notificationHeader}>
              <div style={s.notificationHeading}>
                <span style={s.notificationBell}>{Icons.bell}</span>
                <strong>Notifications</strong>
                {unreadCount > 0 && <span style={s.newBadge}>{unreadCount} new</span>}
              </div>
              <div style={s.notificationHeaderActions}>
                <button type="button" style={{ ...s.filterButton, ...(unreadOnly ? s.filterButtonActive : {}) }} onClick={() => setUnreadOnly(current => !current)}>Unread only</button>
                <button type="button" style={s.markAllButton} onClick={markAllRead}>Mark all read</button>
                <button type="button" style={s.closeButton} onClick={() => setShowNotifications(false)} aria-label="Close notifications">{Icons.close}</button>
              </div>
            </div>
            <div style={s.notificationSummary}>Showing notifications for <strong>{user.role}</strong> · {notifications.length} total</div>
            <div style={s.notificationList}>
              {visibleNotifications.map(notification => (
                <div key={notification.id} style={{ ...s.notificationItem, ...(notification.unread ? s.unreadItem : {}) }}>
                  <div style={{ ...s.notificationIcon, color: notification.color }}><span style={s.notificationIconSvg}>{Icons[notification.icon] || Icons.info}</span></div>
                  <div style={s.notificationContent}>
                    <div style={s.notificationTitle}>
                      <span>{notification.title}</span>
                      {notification.unread && <span style={{ ...s.unreadDot, background: notification.color }} />}
                    </div>
                    <div style={s.notificationText}>{notification.text}</div>
                    <div style={s.notificationMeta}>{notification.time}{notification.pet ? `  ·  ${notification.pet}` : ''}</div>
                  </div>
                  <button type="button" style={s.notificationArrow} onClick={() => markRead(notification.id)} aria-label={notification.unread ? 'Mark notification as read' : 'Notification read'}>
                    {notification.unread ? 'Mark read' : <span style={s.notificationArrowIcon}>{Icons.arrowRight}</span>}
                  </button>
                </div>
              ))}
              {visibleNotifications.length === 0 && <div style={s.emptyNotifications}>No unread notifications</div>}
            </div>
            <button type="button" style={s.viewAllButton} onClick={() => setShowAll(current => !current)}>
              {showAll ? 'Show fewer notifications' : 'View all notifications'}
            </button>
          </div>
        )}

        <div style={s.pill}>
          <div style={s.avatar}>{user.initials}</div>
          <div>
            <div style={s.pillName}>{user.name}</div>
            <div style={s.pillRole}>{user.role}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 28px',
    background: '#fff',
    borderBottom: '1px solid #e8ecf0',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    gap: 16,
  },
  title: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '1.25rem',
    fontWeight: 600,
    letterSpacing: '-.01em',
    color: '#004f43',
  },
  subtitle: { fontSize: '.9rem', color: '#64748b', marginTop: 1 },
  right: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 },
  notif: {
    position: 'relative',
    padding: 6,
    borderRadius: 8,
    color: '#64748b',
    display: 'flex',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
  },
  notifActive: {
    background: '#f1f5f9',
  },
  notifIcon: { width: 17, height: 17, display: 'flex' },
  pip: {
    position: 'absolute',
    top: 5, right: 5,
    width: 7, height: 7,
    background: '#dc2626',
    borderRadius: '50%',
    border: '1.5px solid #fff',
  },
  notificationPanel: {
    position: 'absolute',
    top: 'calc(100% + 1px)',
    right: 28,
    width: 390,
    maxWidth: 'calc(100vw - 32px)',
    background: '#fff',
    border: '1px solid #e8ecf0',
    borderRadius: '0 0 10px 10px',
    boxShadow: '0 14px 30px rgba(15, 23, 42, .14)',
    overflow: 'hidden',
    zIndex: 30,
  },
  notificationHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 12px 10px', borderBottom: '1px solid #e7edf4' },
  notificationHeading: { display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a', fontSize: '.86rem' },
  notificationBell: { width: 15, height: 15, display: 'flex', color: '#64748b' },
  newBadge: { padding: '4px 8px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', fontSize: '.64rem', fontWeight: 600 },
  notificationHeaderActions: { display: 'flex', alignItems: 'center', gap: 7 },
  filterButton: { border: 0, borderRadius: 12, padding: '4px 8px', background: '#fff', color: '#005447', fontSize: '.64rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  filterButtonActive: { background: '#005447', color: '#fff' },
  markAllButton: { border: 0, background: 'transparent', color: '#005447', fontSize: '.64rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  closeButton: { width: 18, height: 18, display: 'flex', padding: 1, border: 0, background: 'transparent', color: '#94a3b8', cursor: 'pointer' },
  notificationSummary: { padding: '8px 12px', background: '#f8fafc', color: '#64748b', fontSize: '.64rem', borderBottom: '1px solid #edf2f7' },
  notificationList: { maxHeight: 462, overflowY: 'auto' },
  notificationItem: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 12px', borderBottom: '1px solid #edf2f7' },
  unreadItem: { background: '#fbfdff' },
  notificationIcon: { width: 30, height: 30, borderRadius: 9, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notificationIconSvg: { width: 15, height: 15, display: 'flex' },
  notificationContent: { flex: 1, minWidth: 0 },
  notificationTitle: { display: 'flex', alignItems: 'center', gap: 6, color: '#172033', fontSize: '.74rem', fontWeight: 600, lineHeight: 1.3 },
  unreadDot: { width: 5, height: 5, borderRadius: '50%', flexShrink: 0 },
  notificationText: { marginTop: 3, color: '#405673', fontSize: '.68rem', lineHeight: 1.35 },
  notificationMeta: { marginTop: 4, color: '#8aa0bd', fontSize: '.63rem' },
  notificationArrow: { alignSelf: 'center', minWidth: 48, border: 0, background: 'transparent', color: '#005447', fontSize: '.62rem', cursor: 'pointer', padding: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' },
  notificationArrowIcon: { width: 12, height: 12, display: 'flex', color: '#cbd5e1' },
  emptyNotifications: { padding: '30px 12px', textAlign: 'center', color: '#64748b', fontSize: '.75rem' },
  viewAllButton: { width: '100%', padding: '12px', border: 0, borderTop: '1px solid #e7edf4', background: '#fff', color: '#005447', fontSize: '.75rem', cursor: 'pointer' },
  pill: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '5px 10px 5px 5px',
    borderRadius: 30,
    border: '1px solid #e8ecf0',
  },
  avatar: {
    width: 28, height: 28,
    borderRadius: '50%',
    background: '#006b5b',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '.8rem',
    fontWeight: 600,
    letterSpacing: '.02em',
  },
  pillName: { fontSize: '.95rem', fontWeight: 500, color: '#0f1117' },
  pillRole: { fontSize: '.8rem', color: '#64748b' },
};