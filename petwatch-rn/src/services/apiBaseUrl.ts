const loopback = (host: string) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
const localHost = (host: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.endsWith('.local');

export function resolveApiUrl({ configuredUrl, platform, scriptUrl, webHostname }: {
  configuredUrl?: string; platform: string; scriptUrl?: string; webHostname?: string;
}) {
  let developmentHost = '';
  try { developmentHost = new URL(scriptUrl || '').hostname; } catch { /* No development bundle URL in a standalone build. */ }
  if (configuredUrl?.trim()) {
    const configured = new URL(configuredUrl.trim());
    if (!['http:', 'https:'].includes(configured.protocol)) throw new Error('The API address must start with http:// or https://.');
    // A copied localhost setting must not send physical-device requests to the phone.
    if (platform !== 'web' && loopback(configured.hostname)) {
      if (localHost(developmentHost)) configured.hostname = developmentHost;
      else if (platform === 'android' && loopback(developmentHost)) configured.hostname = '10.0.2.2';
      else if (platform !== 'ios') throw new Error('Set EXPO_PUBLIC_API_URL to your computer’s Wi-Fi address or backend tunnel URL, ending in /api.');
    }
    return configured.toString().replace(/\/+$/, '');
  }
  if (platform === 'web') return `http://${webHostname || 'localhost'}:3000/api`;
  if (localHost(developmentHost)) return `http://${developmentHost}:3000/api`;
  if (platform === 'android' && loopback(developmentHost)) return 'http://10.0.2.2:3000/api';
  if (platform === 'ios' && loopback(developmentHost)) return 'http://localhost:3000/api';
  // An Expo tunnel exposes Metro, not the backend on port 3000.
  throw new Error('Set EXPO_PUBLIC_API_URL to your computer’s Wi-Fi address or backend tunnel URL, ending in /api.');
}
