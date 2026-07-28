import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { TaskProvider } from './context/TaskContext.jsx';
import AppShell from './components/layout/AppShell.jsx';
import { Mark } from './components/common/Logo.jsx';

import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Today from './pages/Today.jsx';
import GoogleAuthCallback from './pages/GoogleAuthCallback.jsx';

// Heavier, less-visited routes are split out of the initial bundle.
const Tasks = lazy(() => import('./pages/Tasks.jsx'));
const Calendar = lazy(() => import('./pages/Calendar.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));

function Splash({ label = 'Loading' }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <Mark size={46} className="splash__mark" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function Protected({ children }) {
  const { isAuthed, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location }} />;
  return (
    <TaskProvider>
      <AppShell>
        <Suspense fallback={<Splash />}>{children}</Suspense>
      </AppShell>
    </TaskProvider>
  );
}

function PublicOnly({ children }) {
  const { isAuthed, loading } = useAuth();
  if (loading) return <Splash />;
  if (isAuthed) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/auth/callback" element={<GoogleAuthCallback />} />

      <Route path="/app" element={<Protected><Today /></Protected>} />
      <Route path="/app/tasks" element={<Protected><Tasks /></Protected>} />
      <Route path="/app/calendar" element={<Protected><Calendar /></Protected>} />
      <Route path="/app/settings" element={<Protected><Settings /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
