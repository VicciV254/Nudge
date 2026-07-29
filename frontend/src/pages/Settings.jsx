import { useState } from 'react';
import Icon from '../components/common/Icon.jsx';
import CalendarIntegration from '../components/calendar/CalendarIntegration.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getReminderSettings,
  setReminderSettings,
  REMINDER_LEAD_OPTIONS,
} from '../hooks/usePwaTaskReminders.js';

export default function Settings() {
  const { mode, isExplicit, toggle, useSystem } = useTheme();
  const { user } = useAuth();
  const [name, setName] = useState(user?.displayName || '');
  const [reminders, setReminders] = useState(() => getReminderSettings());

  const updateReminderSetting = (next) => {
    setReminders(next);
    setReminderSettings(next);
  };

  return (
    <div className="page page--narrow">
      <header className="page__head">
        <div>
          <div className="page__eyebrow">Preferences</div>
          <h1 className="page__title">Settings</h1>
        </div>
      </header>

      <section className="card panel">
        <div className="panel__head"><Icon name="settings" size={17} /><b>Profile</b></div>
        <div className="panel__body">
          <div className="field">
            <label className="field__label" htmlFor="dn">Display name</label>
            <input id="dn" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field" style={{ marginTop: 'var(--space-4)' }}>
            <span className="field__label">Email</span>
            <div className="readonly">{user?.email}</div>
          </div>
        </div>
        <div className="panel__foot"><button className="btn">Save profile</button></div>
      </section>

      <section className="card panel">
        <div className="panel__head">
          <Icon name={mode === 'dark' ? 'moon' : 'sun'} size={17} /><b>Appearance</b>
        </div>
        <div className="panel__body">
          <div className="field">
            <span className="field__label">Theme</span>
            <div className="segs">
              <button
                className={`seg ${mode === 'light' && isExplicit ? 'seg--on' : ''}`}
                onClick={() => { if (mode !== 'light') toggle(); }}
              >
                <Icon name="sun" size={13} /> Light
              </button>
              <button
                className={`seg ${mode === 'dark' && isExplicit ? 'seg--on' : ''}`}
                onClick={() => { if (mode !== 'dark') toggle(); }}
              >
                <Icon name="moon" size={13} /> Dark
              </button>
              <button className={`seg ${!isExplicit ? 'seg--on' : ''}`} onClick={useSystem}>
                System
              </button>
            </div>
            <p className="field__hint" style={{ marginTop: 'var(--space-2)' }}>
              Ember is the only theme shipped today. Both modes are contrast-audited to WCAG AA.
            </p>
          </div>
        </div>
      </section>

      <section className="card panel">
        <div className="panel__head"><Icon name="bell" size={17} /><b>Reminders</b></div>
        <div className="panel__body">
          <label className="toggle">
            <input
              type="checkbox"
              checked={reminders.enabled}
              onChange={(e) => updateReminderSetting({ ...reminders, enabled: e.target.checked })}
            />
            <span className="toggle__track" aria-hidden="true"><span className="toggle__dot" /></span>
            <span className="toggle__label">Enable reminder notifications</span>
          </label>

          <div className="field" style={{ marginTop: 'var(--space-4)' }}>
            <span className="field__label">Reminder lead time</span>
            <div className="segs">
              {REMINDER_LEAD_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={`seg ${reminders.leadMinutes === minutes ? 'seg--on' : ''}`}
                  onClick={() => updateReminderSetting({ ...reminders, leadMinutes: minutes })}
                  disabled={!reminders.enabled}
                >
                  {minutes}m
                </button>
              ))}
            </div>
          </div>

          <p className="field__hint" style={{ marginTop: 'var(--space-2)' }}>
            Reminders run in the installed app and alert you before due time.
          </p>
        </div>
      </section>

      <CalendarIntegration />
    </div>
  );
}
