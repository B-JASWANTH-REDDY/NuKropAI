import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X, RotateCcw } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  undoLabel?: string;
  onUndo?: () => void;
  duration?: number;
}

interface ToastContextType {
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const duration = toast.duration ?? 4000;
      const newToast: ToastMessage = { ...toast, id };

      setToasts((prev) => [...prev.slice(-3), newToast]); // Keep maximum 4 concurrent

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div 
        className="toast-container" 
        role="region" 
        aria-label="Notifications"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div 
            key={t.id} 
            className={`toast-item ${t.type}`}
            role="status"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {t.type === 'success' && <CheckCircle2 style={{ width: '18px', height: '18px', color: '#22C55E', flexShrink: 0 }} />}
              {t.type === 'error' && <AlertCircle style={{ width: '18px', height: '18px', color: '#EF4444', flexShrink: 0 }} />}
              {t.type === 'info' && <Info style={{ width: '18px', height: '18px', color: '#C8E837', flexShrink: 0 }} />}
              <span style={{ lineHeight: 1.4 }}>{t.message}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {t.onUndo && (
                <button
                  onClick={() => {
                    t.onUndo?.();
                    removeToast(t.id);
                  }}
                  className="touch-target"
                  style={{
                    background: 'rgba(200, 232, 55, 0.15)',
                    border: '1px solid rgba(200, 232, 55, 0.3)',
                    color: 'var(--nukrop-accent)',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  aria-label={t.undoLabel || 'Undo action'}
                >
                  <RotateCcw style={{ width: '12px', height: '12px' }} />
                  {t.undoLabel || 'Undo'}
                </button>
              )}
              <button
                onClick={() => removeToast(t.id)}
                className="touch-target"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--nukrop-text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px'
                }}
                aria-label="Dismiss notification"
              >
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
