import { createContext, useContext, useState, useCallback, useRef } from 'react';
import Icon from '../components/common/Icon.jsx';

/**
 * Toasts.
 *
 * Tone rule: a failed action is an inconvenience, not an emergency. Errors use
 * --sync-error (a muted brick), never a saturated alarm red. On a screen where
 * several things can fail at once, saturated red makes the whole app feel broken.
 */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, { variant = 'ok', duration = 4000 } = {}) => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, message, variant }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const api = {
    push,
    dismiss,
    success: (m, o) => push(m, { ...o, variant: 'ok' }),
    error: (m, o) => push(m, { ...o, variant: 'error' }),
    info: (m, o) => push(m, { ...o, variant: 'pending' }),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.variant} anim-in`}>
            <Icon
              name={t.variant === 'error' ? 'alert' : t.variant === 'pending' ? 'sync' : 'check'}
              size={16}
            />
            <span className="toast__msg">{t.message}</span>
            <button
              className="toast__x"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
