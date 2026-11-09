import ClinicAttachmentImage from './ClinicAttachmentImage';
import StatusIndicator from './StatusIndicator';

const modalStyles = {
  backdrop: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  vaccinationActionsDialog: { position: 'relative', width: 'min(540px, 100%)', maxWidth: '100%', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxSizing: 'border-box', background: '#fff', borderRadius: 14, padding: '18px 20px 15px', boxShadow: '0 20px 55px rgba(15,23,42,.25)', color: '#111827' },
  vaccinationActionsClose: { position: 'absolute', top: 17, right: 18, border: 0, background: 'none', color: '#111827', cursor: 'pointer', width: 18, height: 18, display: 'flex', padding: 0 },
  vaccinationActionsHeader: { display: 'flex', alignItems: 'center', gap: 11, marginBottom: 11, paddingRight: 25 },
  vaccinationActionsTitle: { margin: 0, color: '#004f43', fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.25 },
  vaccinationActionsSubtitle: { marginTop: 4, color: '#111827', fontSize: '.78rem', lineHeight: 1.3 },
  vaccinationActionsPet: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', marginBottom: 11, borderRadius: 10, background: '#f2f8ff' },
  vaccinationActionsPetInfo: { display: 'flex', alignItems: 'center', gap: 11 },
  vaccinationActionsPetImage: { width: 38, height: 38, objectFit: 'cover', borderRadius: '50%' },
  vaccinationActionsPetFallback: { width: 38, height: 38, flex: '0 0 38px', display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#e7f4ec', color: '#013826', fontWeight: 700 },
  vaccinationActionsPetName: { color: '#004f43', fontSize: '.9rem', fontWeight: 800 },
  vaccinationActionsPetMeta: { marginTop: 2, color: '#111827', fontSize: '.66rem' },
  vaccinationActionsList: { display: 'grid', gap: 8 },
  vaccinationActionCard: { display: 'flex', alignItems: 'center', gap: 11, width: '100%', minHeight: 58, boxSizing: 'border-box', borderRadius: 10, padding: '8px 11px', textAlign: 'left', cursor: 'pointer' },
  vaccinationActionCardText: { display: 'grid', gap: 3, flex: 1 },
  vaccinationActionCardTitle: { color: '#004f43', fontSize: '.86rem', fontWeight: 800 },
  vaccinationActionCardDescription: { color: '#111827', fontSize: '.65rem', lineHeight: 1.3 },
  vaccinationActionsFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, paddingTop: 10, borderTop: '1px solid #e6edf3' },
  vaccinationActionsNote: { color: '#111827', fontSize: '.62rem', lineHeight: 1.3 },
  vaccinationActionsCancel: { border: '1px solid #cfdce9', borderRadius: 7, background: '#fff', color: '#111827', padding: '7px 12px', fontSize: '.7rem', fontWeight: 700, cursor: 'pointer' },
};

export default function RecordActionsModal({ title, recordLabel, recordName, recordMeta, status, recordPhoto, recordPhotoAttachmentId, user, showPetAvatar = false, hideRecordSubtitle = false, onClose, actions, error }) {
  return <div style={modalStyles.backdrop} onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={title} onClick={event => event.stopPropagation()} style={modalStyles.vaccinationActionsDialog}>
      <button type="button" onClick={onClose} style={{ ...modalStyles.vaccinationActionsClose, width: 'auto', height: 'auto', font: 'inherit', fontSize: '.72rem', fontWeight: 600 }}>Close</button>
      <div style={modalStyles.vaccinationActionsHeader}>
        <div>
          <h2 style={modalStyles.vaccinationActionsTitle}>{title}</h2>
          {!hideRecordSubtitle && <div style={modalStyles.vaccinationActionsSubtitle}>{recordLabel} · {recordName}</div>}
        </div>
      </div>
      <div style={modalStyles.vaccinationActionsPet}>
        <div style={modalStyles.vaccinationActionsPetInfo}>
          {showPetAvatar && <ClinicAttachmentImage
            src={recordPhoto}
            attachmentId={recordPhotoAttachmentId}
            user={user}
            alt={`${recordName} profile`}
            style={modalStyles.vaccinationActionsPetImage}
            fallback={<span aria-hidden="true" style={modalStyles.vaccinationActionsPetFallback}>{String(recordName || 'P').slice(0, 1).toUpperCase()}</span>}
          />}
          <div>
            <div style={modalStyles.vaccinationActionsPetName}>{recordName}</div>
            <div style={modalStyles.vaccinationActionsPetMeta}>{recordMeta}</div>
          </div>
        </div>
        {status && <StatusIndicator status={status} />}
      </div>
      <div style={modalStyles.vaccinationActionsList}>
        {actions.map(action => <button
          type="button"
          key={action.label}
          className={`record-action-card vaccination-action-button${action.destructive ? ' record-action-card-destructive' : ''}`}
          onClick={action.onClick}
          style={{
            ...modalStyles.vaccinationActionCard,
            border: action.destructive ? '1px solid #ffc0c8' : '1px solid #b7e4d7',
            background: action.destructive ? '#fff5f6' : '#f2fbf8',
          }}
        >
          <span style={modalStyles.vaccinationActionCardText}>
            <strong style={{ ...modalStyles.vaccinationActionCardTitle, ...(action.destructive ? { color: '#9f263d' } : {}) }}>{action.label}</strong>
            <small style={modalStyles.vaccinationActionCardDescription}>{action.description}</small>
          </span>
        </button>)}
      </div>
      {error && <p role="alert" style={{ margin: '10px 0 0', color: '#b91c1c', fontSize: '.74rem' }}>{error}</p>}
      <div style={modalStyles.vaccinationActionsFooter}>
        <span style={modalStyles.vaccinationActionsNote}>Choose an action for this {recordLabel.toLowerCase()}.</span>
        <button type="button" style={modalStyles.vaccinationActionsCancel} onClick={onClose}>Cancel</button>
      </div>
    </div>
  </div>;
}
