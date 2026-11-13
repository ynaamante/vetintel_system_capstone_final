export function notifyLabResultsChanged() {
  window.dispatchEvent(new Event('vetintel:appointment-updated'));
  try { localStorage.setItem('vetintel:lab-results-changed', String(Date.now()) + Math.random()); } catch { /* Polling remains available. */ }
}
