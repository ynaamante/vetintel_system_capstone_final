import { hasAction } from '../utils/permissionUtils';
import { useEffect, useRef } from 'react';
import ClinicAttachmentImage from './ClinicAttachmentImage';
import StatusIndicator from './StatusIndicator';
import { Icons } from '../icons';
import './recordActionsModal.css';

const actionPermissions = {
  'Edit Owner': 'Edit Owner', 'Archive Owner': 'Archive Owner', 'Restore Owner': 'Archive Owner',
  'Transfer Pet': 'Edit Pet Records', 'Edit Pet': 'Edit Pet Records', 'Archive Pet': 'Archive Pet Records', 'Restore Pet': 'Archive Pet Records',
  'Start Consultation': 'Create Consultation', 'Archive Appointment': 'Cancel Appointment', 'Restore Appointment': 'Cancel Appointment',
};
function actionIcon(action) {
  if (action.icon) return action.icon;
  const label = action.label.toLowerCase();
  if (action.destructive) return Icons.trash;
  if (label.startsWith('restore')) return Icons.refresh;
  if (label.includes('audit') || label.includes('history')) return Icons.clipboard;
  if (label.includes('appointment')) return Icons.calendar;
  if (label.startsWith('edit') || label.startsWith('enter')) return Icons.edit;
  return Icons.file;
}

const avatarStyle = { width: 40, height: 40, objectFit: 'cover', borderRadius: '50%', flexShrink: 0 };

export default function RecordActionsModal({ title, recordLabel, recordName, recordMeta, status, recordPhoto, recordPhotoAttachmentId, recordInitials, user, showPetAvatar = false, hideRecordSubtitle = false, suspended = false, iconOnlyClose = false, onClose, actions, error, footerNote }) {
  const closeButton = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    if (!suspended) closeButton.current?.focus();
  }, [suspended]);

  const visibleActions = actions.filter(action => {
    const permission = action.permission || actionPermissions[action.label];
    return !action.disabled && (!user || !permission || hasAction(user.permissions, user.role, permission));
  });
  return (
    <div className="record-actions-backdrop" inert={suspended ? '' : undefined} onClick={onClose} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    }}>
      <div className="record-actions-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={event => event.stopPropagation()}>
        <header>
          <div><h2>{title}</h2>{!hideRecordSubtitle && <p>{recordLabel} · {recordName}</p>}</div>
          <button type="button" className={`record-actions-close${iconOnlyClose ? ' is-icon-only' : ''}`} aria-label="Close dialog" ref={closeButton} onClick={onClose}><span aria-hidden="true">{Icons.close}</span>{!iconOnlyClose && 'Close'}</button>
        </header>
        <div className="record-actions-summary">
          {recordInitials && <span className="record-actions-avatar" aria-hidden="true">{recordInitials}</span>}
          {showPetAvatar && <ClinicAttachmentImage
            src={recordPhoto}
            attachmentId={recordPhotoAttachmentId}
            user={user}
            alt={`${recordName} profile`}
            style={avatarStyle}
            fallback={<span className="record-actions-avatar" aria-hidden="true">{String(recordName || 'P').slice(0, 1).toUpperCase()}</span>}
          />}
          <div className="record-actions-summary-text"><strong>{recordName}</strong><span>{recordMeta}</span></div>
          {status && <div className="record-actions-status"><StatusIndicator status={status} /></div>}
        </div>
        <div className="record-actions-list">
          {visibleActions.map(action => <button
            type="button"
            key={action.label}
            className={`record-actions-option${action.destructive ? ' is-destructive' : ''}`}
            disabled={action.unavailable}
            onClick={action.onClick}
          >
            <span className="record-actions-icon" aria-hidden="true">{actionIcon(action)}</span>
            <span className="record-actions-option-copy"><strong>{action.label}</strong><small>{action.description}</small></span>
            <span className="record-actions-chevron" aria-hidden="true">{Icons.chevronRight}</span>
          </button>)}
        </div>
        {error && <p role="alert" className="record-actions-error">{error}</p>}
        <footer>
          {footerNote && <span>{footerNote}</span>}
          <button type="button" onClick={onClose}>Cancel</button>
        </footer>
      </div>
    </div>
  );
}
