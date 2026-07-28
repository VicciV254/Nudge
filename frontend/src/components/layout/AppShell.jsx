import { NavLink, useNavigate } from 'react-router-dom';
import { Logo, Mark } from '../common/Logo.jsx';
import Icon from '../common/Icon.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTasks } from '../../context/TaskContext.jsx';

const NAV = [
  { to: '/app', label: 'Today', icon: 'clock', end: true },
  { to: '/app/tasks', label: 'All tasks', icon: 'inbox' },
  { to: '/app/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/app/settings', label: 'Settings', icon: 'settings' },
];

export function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <button
      className="btn btn--ghost btn--icon"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      <Icon name={isDark ? 'sun' : 'moon'} size={17} />
    </button>
  );
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { counts } = useTasks();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initial = (user?.displayName || user?.email || 'N').charAt(0).toUpperCase();

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>

      <aside className="sidebar">
        <div className="sidebar__brand">
          <Logo size={28} />
        </div>

        <nav className="sidebar__nav" aria-label="Main">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `navitem ${isActive ? 'navitem--on' : ''}`}
            >
              <Icon name={n.icon} size={17} strokeWidth={2.1} />
              <span>{n.label}</span>
              {n.to === '/app' && counts.today > 0 && (
                <span className="navitem__n">{counts.today}</span>
              )}
              {n.to === '/app/tasks' && counts.overdue > 0 && (
                <span className="navitem__n navitem__n--warn">{counts.overdue}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__foot">
          <div className="userbox">
            <span className="userbox__av">{initial}</span>
            <span className="userbox__meta">
              <span className="userbox__name">{user?.displayName || 'You'}</span>
              <span className="userbox__mail">{user?.email}</span>
            </span>
          </div>
          <div className="sidebar__actions">
            <ThemeToggle />
            <button className="btn btn--ghost btn--icon" onClick={onLogout} aria-label="Log out">
              <Icon name="logout" size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="topbar">
        <Mark size={26} />
        <span className="topbar__title">Nudge</span>
        <div className="topbar__spacer" />
        <ThemeToggle />
      </header>

      <main className="main" id="main">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => `tabitem ${isActive ? 'tabitem--on' : ''}`}
          >
            <Icon name={n.icon} size={19} strokeWidth={2.1} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
