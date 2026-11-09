import { getStatusToneColors } from '../utils/statusTone';

function formatStatusLabel(status) {
  const raw = String(status || '').trim();
  if (!raw) return 'Unknown';
  return raw.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()).replace(/-Show\b/g, '-show');
}

export default function StatusIndicator({ status, label, className = '', style }) {
  const tone = getStatusToneColors(status);

  return (
    <span className={`status-indicator ${className}`.trim()} style={{ ...style, color: tone.text }}>
      <span className="status-indicator-dot" style={{ background: tone.dot }} aria-hidden="true" />
      <span>{label || formatStatusLabel(status)}</span>
    </span>
  );
}
