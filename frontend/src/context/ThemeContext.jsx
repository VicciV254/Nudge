import { createContext, useContext, useEffect, useState, useCallback } from 'react';

/**
 * Light/dark mode.
 *
 * The initial value is already written to <html data-mode> by the inline script
 * in index.html (before first paint). We read it back from the DOM rather than
 * recomputing, so React never disagrees with what the user is already seeing.
 */

const ThemeContext = createContext(null);
const STORAGE_KEY = 'nudge-mode';

function readInitialMode() {
  if (typeof document === 'undefined') return 'light';
  const attr = document.documentElement.getAttribute('data-mode');
  if (attr === 'light' || attr === 'dark') return attr;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
  } catch {
    /* private mode — fall through */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(readInitialMode);
  // Whether the user has made an explicit choice. If not, we keep following the OS.
  const [isExplicit, setIsExplicit] = useState(() => {
    try {
      return Boolean(localStorage.getItem(STORAGE_KEY));
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-mode', mode);
    document.documentElement.setAttribute('data-theme', 'ember');

    // Keep the browser chrome in step with --bg-canvas. Read the token rather
    // than hardcoding the hex, so a palette change can't leave the status bar
    // showing a colour the app no longer uses.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const canvas = getComputedStyle(document.documentElement)
        .getPropertyValue('--bg-canvas')
        .trim();
      if (canvas) meta.setAttribute('content', canvas);
    }
  }, [mode]);

  // Follow the OS until the user overrides it.
  useEffect(() => {
    if (isExplicit) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setMode(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [isExplicit]);

  const toggle = useCallback(() => {
    setMode((m) => {
      const next = m === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
    setIsExplicit(true);
  }, []);

  const useSystem = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setIsExplicit(false);
    setMode(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, isDark: mode === 'dark', isExplicit, toggle, useSystem }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
