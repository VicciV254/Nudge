import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import './styles/globals.css';

function openTaskFromNotification(taskId, url) {
  if (typeof window === 'undefined') return;
  const target = url || (taskId ? `/app/calendar?task=${encodeURIComponent(taskId)}` : '/app/calendar');
  if (`${window.location.pathname}${window.location.search}` === target) return;
  window.location.assign(target);
}

window.addEventListener('nudge:open-task', (event) => {
  const detail = event?.detail || {};
  openTaskFromNotification(detail.taskId, detail.url);
});

registerSW({
  immediate: true,
  onRegisteredSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event?.data?.type !== 'nudge-open-task') return;
      openTaskFromNotification(event.data.taskId, event.data.url);
    });
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
