/** Shared accessible surface for modal dialogs. Keep workflow state in the caller. */
export function ModalDialog({ as: Element = 'div', size = 'standard', className = '', children, ...props }) {
  void size;
  return <Element className={className || undefined} {...props}>{children}</Element>;
}

export function ModalTitle({ as: Element = 'h2', className = '', ...props }) {
  return <Element className={['vi-modal__title', className].filter(Boolean).join(' ')} {...props} />;
}

export function ModalHeader({ as: Element = 'header', className = '', ...props }) {
  return <Element className={['vi-modal__header', className].filter(Boolean).join(' ')} {...props} />;
}

export function ModalDescription({ as: Element = 'p', className = '', ...props }) {
  return <Element className={['vi-modal__description', className].filter(Boolean).join(' ')} {...props} />;
}

export function ModalFooter({ className = '', ...props }) {
  return <div className={['vi-modal__footer', className].filter(Boolean).join(' ')} {...props} />;
}

export function ModalStepper({ as: Element = 'ol', className = '', ...props }) {
  return <Element className={['vi-modal__stepper', className].filter(Boolean).join(' ')} {...props} />;
}
