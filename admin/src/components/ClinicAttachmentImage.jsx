import { useEffect, useRef, useState } from 'react';

// Keep a small per-tab cache so a pet photo reused by another view doesn't
// trigger another authenticated download. Cache blobs rather than object URLs:
// each mounted image owns and revokes its own object URL.
const PHOTO_CACHE_LIMIT = 40;
const photoBlobCache = new Map();

async function getPhotoBlob(cacheKey, url, token, signal) {
  let pending = photoBlobCache.get(cacheKey);
  if (!pending) {
    // A shared request must not use one component's abort signal: another
    // mounted view may be waiting for the same photo.
    pending = fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(response => {
        if (!response.ok) throw new Error('Unable to load image');
        return response.blob();
      });
    photoBlobCache.set(cacheKey, pending);
    pending.catch(() => {
      if (photoBlobCache.get(cacheKey) === pending) photoBlobCache.delete(cacheKey);
    });
  } else {
    // Refresh insertion order for a basic least-recently-used eviction policy.
    photoBlobCache.delete(cacheKey);
    photoBlobCache.set(cacheKey, pending);
  }

  const blob = await pending;
  if (signal.aborted) return null;
  while (photoBlobCache.size > PHOTO_CACHE_LIMIT) {
    const oldestKey = photoBlobCache.keys().next().value;
    if (oldestKey === cacheKey && photoBlobCache.size === 1) break;
    photoBlobCache.delete(oldestKey);
  }
  return blob;
}

/** Loads a private clinic attachment only when the image is near the viewport. */
export default function ClinicAttachmentImage({
  attachmentId,
  src,
  user,
  alt = '',
  fallback = null,
  ...imageProps
}) {
  const targetRef = useRef(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoadedSrc('');
    setFailed(false);
    setIsNearViewport(false);
    if (src || !attachmentId || !user?.token || !user?.clinic_id) return undefined;

    const target = targetRef.current;
    if (!target || !('IntersectionObserver' in window)) {
      setIsNearViewport(true);
      return undefined;
    }

    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setIsNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '160px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [attachmentId, src, user?.clinic_id, user?.token]);

  useEffect(() => {
    if (src || !attachmentId || !user?.token || !user?.clinic_id || !isNearViewport) return undefined;

    const controller = new AbortController();
    let objectUrl = '';
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    const cacheKey = `${user.clinic_id}:${attachmentId}`;
    const contentUrl = `${apiUrl}/clinic-records/attachments/${encodeURIComponent(attachmentId)}/content?clinic_id=${encodeURIComponent(user.clinic_id)}`;

    getPhotoBlob(cacheKey, contentUrl, user.token, controller.signal).then(blob => {
      if (!blob || controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setLoadedSrc(objectUrl);
    }).catch(error => {
      if (error.name !== 'AbortError') setFailed(true);
    });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId, isNearViewport, src, user?.clinic_id, user?.token]);

  if (failed) return fallback;
  if (src) return <img {...imageProps} src={src} alt={alt} loading="lazy" />;
  if (!attachmentId || !user?.token || !user?.clinic_id) return fallback;

  return (
    <span
      ref={targetRef}
      style={{
        display: 'inline-grid', placeItems: 'center', verticalAlign: 'middle',
        width: imageProps.style?.width, height: imageProps.style?.height,
        position: imageProps.style?.position, inset: imageProps.style?.inset,
        borderRadius: imageProps.style?.borderRadius, overflow: imageProps.style?.overflow,
      }}
      aria-hidden="true"
    >
      {fallback && <span style={{ gridArea: '1 / 1' }}>{fallback}</span>}
      {loadedSrc && <img {...imageProps} src={loadedSrc} alt={alt} loading="lazy" style={{ ...imageProps.style, gridArea: '1 / 1' }} />}
    </span>
  );
}
