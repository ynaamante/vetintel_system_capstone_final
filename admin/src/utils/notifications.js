const EVENT_NAME = 'vetintel:notification';

export function notifySuccess(title, text) {
  const notification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    icon: 'check',
    color: 'var(--success)',
    title,
    text,
    time: 'Just now',
    unread: true,
  };

  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: notification }));
  return notification;
}

export function subscribeToNotifications(listener) {
  const handleNotification = event => listener(event.detail);
  window.addEventListener(EVENT_NAME, handleNotification);
  return () => window.removeEventListener(EVENT_NAME, handleNotification);
}
