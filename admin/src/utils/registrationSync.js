export const REGISTRATION_UPDATED = 'vetintel:registration-updated';

export function announceRegistrationUpdate() {
  window.dispatchEvent(new Event(REGISTRATION_UPDATED));
}

// Polling also covers reception and doctors signed in on separate devices.
export function watchRegistrationUpdates(refresh) {
  const onRefresh = () => {
    if (!document.hidden) refresh();
  };
  const timer = window.setInterval(onRefresh, 15000);
  window.addEventListener(REGISTRATION_UPDATED, onRefresh);
  window.addEventListener('focus', onRefresh);
  document.addEventListener('visibilitychange', onRefresh);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener(REGISTRATION_UPDATED, onRefresh);
    window.removeEventListener('focus', onRefresh);
    document.removeEventListener('visibilitychange', onRefresh);
  };
}
