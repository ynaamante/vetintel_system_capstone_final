// Keep recent page data in memory and share reads across components/navigation.
// Authentication and permission requests always reach the server.
export function createApiFetch(networkFetch, { baseUrl, origin, now = Date.now, ttl = 30000 } = {}) {
  const base = new URL(baseUrl || '/api', origin);
  const prefix = base.pathname.replace(/\/+$/, '');
  const cache = new Map();
  const pending = new Map();
  let generation = 0;
  let principal;

  const clear = () => {
    generation += 1;
    cache.clear();
    pending.clear();
  };

  // A caller leaving a page must not cancel another caller's shared request.
  const subscribe = (promise, signal) => {
    if (!signal) return promise.then(response => response.clone());
    if (signal.aborted) return Promise.reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    return new Promise((resolve, reject) => {
      const abort = () => reject(signal.reason || new DOMException('Aborted', 'AbortError'));
      signal.addEventListener('abort', abort, { once: true });
      promise.then(response => {
        if (!signal.aborted) resolve(response.clone());
      }, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  };

  const fetch = async (input, options = {}) => {
    // Request objects can carry streaming bodies and other per-request behavior.
    if (typeof input !== 'string' && !(input instanceof URL)) return networkFetch(input, options);
    const url = new URL(input, origin);
    const isApi = url.origin === base.origin && (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
    if (!isApi) return networkFetch(input, options);
    const headers = new Headers(options.headers);
    const token = headers.get('Authorization');
    if (principal !== token) {
      clear();
      principal = token;
    }
    const method = (options.method || 'GET').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      clear();
      try {
        return await networkFetch(input, options);
      } finally {
        // Also discard reads that started while a write was in progress.
        clear();
      }
    }
    const path = url.pathname.slice(prefix.length);
    const bypass = method !== 'GET' || !token || ['no-store', 'reload', 'no-cache'].includes(options.cache)
      || /^\/(me|login|password|roles|permissions|users)(\/|$)/.test(path)
      || /\/(events|attachments|export|download|content)(\/|$)/.test(path);
    if (bypass) {
      const response = await networkFetch(input, options);
      if (response.status === 401 || response.status === 403) clear();
      return response;
    }
    if (options.signal?.aborted) throw options.signal.reason || new DOMException('Aborted', 'AbortError');

    const key = `${url.href}\n${JSON.stringify([...headers.entries()].sort())}\n${options.credentials || 'same-origin'}`;
    const saved = cache.get(key);
    if (saved && now() - saved.time < ttl) return saved.response.clone();
    cache.delete(key);
    let request = pending.get(key);
    if (!request) {
      const version = generation;
      const sharedOptions = { ...options };
      delete sharedOptions.signal;
      request = networkFetch(input, sharedOptions).then(response => {
        if (response.status === 401 || response.status === 403) clear();
        if (version === generation && response.ok && response.headers.get('content-type')?.includes('application/json')
          && !/no-store|private/i.test(response.headers.get('cache-control') || '')) {
          if (cache.size >= 80) cache.delete(cache.keys().next().value);
          cache.set(key, { response: response.clone(), time: now() });
        }
        return response;
      }).finally(() => {
        if (pending.get(key) === request) pending.delete(key);
      });
      pending.set(key, request);
    }
    return subscribe(request, options.signal);
  };
  return { fetch, clear };
}

const client = createApiFetch(globalThis.fetch.bind(globalThis), {
  baseUrl: import.meta.env?.VITE_API_URL || '/api',
  origin: globalThis.location?.origin || 'http://localhost',
});
export const apiFetch = client.fetch;
export const clearApiCache = client.clear;

if (typeof window !== 'undefined') {
  for (const event of ['focus', 'vetintel:permissions-updated', 'vetintel:appointment-updated',
    'vetintel:billing-updated', 'vetintel:registration-updated', 'vetintel:notification']) {
    window.addEventListener(event, clearApiCache);
  }
}
