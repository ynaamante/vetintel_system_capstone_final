import React from 'react';
import { CheckCircle, X } from 'lucide-react';

export function Toast({ message, onClose, variant = 'success' }: { message: string; onClose?: () => void; variant?: 'success' | 'error' }) {
  return (
    <div className={`fixed top-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm ${
      variant === 'error'
        ? 'border border-red-300 bg-red-50 text-[#172b24]'
        : 'bg-green-600 text-white'
    }`}>
      <CheckCircle className={`w-4 h-4 ${variant === 'error' ? 'text-red-500' : ''}`} />
      <div className="flex-1">{message}</div>
      {onClose && (
        <button onClick={onClose} className={variant === 'error' ? 'text-[#526B62] hover:text-[#086b50]' : 'text-white/80 hover:text-white'}>
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
