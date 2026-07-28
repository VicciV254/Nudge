import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../common/Icon.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as cal from '../../api/calendar.js';

/**
 * Google Calendar connection panel — wired to the real API.
 *
 * The consent moment is where users decide whether to trust the integration,
 * so scopes are named in plain language next to the technical scope string.
 */

// Messages the OAuth callback can redirect back with.
const CALLBACK_MESSAGES = {
  connected: ['success', 'Google Calendar connected'],
  denied: ['info', 'Calendar connection cancelled'],
  expired: ['error', 'That connection link expired — please try again'],
  invalid: ['error', 'Something was missing from Google’s response'],
  failed: ['error', 'Could not complete the connection'],
  no_refresh_token: [
    'error',
    'Google did not return a refresh token. Remove Nudge at myaccount.google.com/permissions, then reconnect.',
  ],
};

export default function CalendarIntegration() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [calendars, setCalendars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await cal.getStatus();
      setStatus(s);
      if (s.connected) {
        cal.listCalendars().then(setCalendars).catch(() => {});
      }
    } catch (err) {
      toast.error(err.message || 'Could not load calendar settings');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Surface the result of the OAuth round trip, then clean the URL so a
  // refresh doesn't replay the toast.
  useEffect(() => {
    const result = params.get('calendar');
    if (!result) return;
    const entry = CALLBACK_MESSAGES[result];
    if (entry) {
      const [kind, message] = entry;
      toast[kind === 'success' ? 'success' : kind === 'info' ? 'info' : 'error'](message, {
        duration: kind === 'error' ? 9000 : 4000,
      });
    }
    params.delete('calendar');
    setParams(params, { replace: true });
  }, [params, setParams, toast]);

  const patch = async (data, message) => {
    setBusy(true);
    // Optimistic: the control moves immediately, and we reload on failure.
    setStatus((s) => ({ ...s, ...data }));
    try {
      await cal.saveSettings(data);
      if (message) toast.success(message);
    } catch (err) {
      toast.error(err.message || 'Could not save that');
      load();
    } finally {
      setBusy(false);
    }
  };

  const onConnect = async () => {
    setBusy(true);
    try {
      await cal.beginConnect();
    } catch (err) {
      toast.error(err.message || 'Could not start the connection');
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    setBusy(true);
    try {
      await cal.disconnect();
      toast.info('Google Calendar disconnected');
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not disconnect');
    } finally {
      setBusy(false);
    }
  };

  const onSync = async () => {
    setBusy(true);
    try {
      const r = await cal.syncNow();
      const n = (r.pushed?.pushed ?? 0) + (r.pulled?.updated ?? 0);
      toast.success(n > 0 ? `Synced ${n} change${n === 1 ? '' : 's'}` : 'Everything is up to date');
      await load();
    } catch (err) {
      toast.error(err.message || 'Sync failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="card panel">
        <div className="panel__head">
          <Icon name="calendar" size={17} />
          <b>Google Calendar</b>
        </div>
        <div className="panel__body">
          <span className="skel skel--line" style={{ width: '60%' }} />
        </div>
      </section>
    );
  }

  // The server has no Google credentials — say so plainly instead of showing a
  // button that cannot work.
  if (!status?.configured) {
    return (
      <section className="card panel">
        <div className="panel__head">
          <Icon name="calendar" size={17} />
          <b>Google Calendar</b>
          <span className="chip chip--off panel__badge">Unavailable</span>
        </div>
        <div className="panel__body">
          <p className="panel__lead">
            This server has no Google credentials configured. Set{' '}
            <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> and{' '}
            <code>GOOGLE_REDIRECT_URI</code> to enable calendar sync.
          </p>
        </div>
      </section>
    );
  }

  if (!status.connected) {
    return (
      <section className="card panel">
        <div className="panel__head">
          <Icon name="calendar" size={17} />
          <b>Google Calendar</b>
          <span className="chip chip--off panel__badge">Not connected</span>
        </div>
        <div className="panel__body">
          <p className="panel__lead">
            Nudge will create and update events for tasks that have a due date. You can
            disconnect at any time.
          </p>
          <div className="scopes">
            <div className="scope">
              <Icon name="check" size={13} strokeWidth={3} />
              <div>
                <b>See your calendars</b>
                <span>calendar.readonly</span>
              </div>
            </div>
            <div className="scope">
              <Icon name="check" size={13} strokeWidth={3} />
              <div>
                <b>Create &amp; update events</b>
                <span>calendar.events</span>
              </div>
            </div>
          </div>
          <button className="btn btn--block" onClick={onConnect} disabled={busy}>
            <Icon name="google" size={16} strokeWidth={1.6} />
            {busy ? 'Opening Google…' : 'Connect Google Calendar'}
          </button>
          <p className="panel__fine">Tokens are encrypted at rest (AES-256-GCM).</p>
        </div>
      </section>
    );
  }

  const { counts = {} } = status;
  const hasTrouble = (counts.errored ?? 0) > 0 || (counts.conflicts ?? 0) > 0;

  return (
    <section className="card panel">
      <div className="panel__head">
        <Icon name="calendar" size={17} />
        <b>Google Calendar</b>
        <span className={`chip ${hasTrouble ? 'chip--pending' : 'chip--ok'} panel__badge`}>
          <Icon name="sync" size={11} />
          {hasTrouble ? 'Needs attention' : 'Connected'}
        </span>
      </div>

      <div className="panel__body">
        {hasTrouble && (
          <div className="syncnote">
            <Icon name="alert" size={15} />
            <span>
              {counts.conflicts > 0 && `${counts.conflicts} conflict${counts.conflicts === 1 ? '' : 's'}`}
              {counts.conflicts > 0 && counts.errored > 0 && ' · '}
              {counts.errored > 0 && `${counts.errored} failed to sync`}
            </span>
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="cal-target">Target calendar</label>
          <select
            id="cal-target"
            className="select"
            value={status.calendarId || 'primary'}
            onChange={(e) => patch({ calendarId: e.target.value }, 'Calendar changed')}
            disabled={busy || calendars.length === 0}
          >
            {calendars.length === 0 && <option value="primary">Primary</option>}
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.summary}
                {c.primary ? ' (primary)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ marginTop: 'var(--space-4)' }}>
          <span className="field__label">Sync direction</span>
          <div className="segs">
            {[
              { v: 'both', l: 'Bidirectional' },
              { v: 'push', l: 'Nudge → Google' },
              { v: 'pull', l: 'Google → Nudge' },
            ].map((o) => (
              <button
                key={o.v}
                className={`seg ${status.direction === o.v ? 'seg--on' : ''}`}
                onClick={() => patch({ direction: o.v })}
                disabled={busy}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        <div className="field" style={{ marginTop: 'var(--space-4)' }}>
          <span className="field__label">Default reminder</span>
          <div className="segs">
            {[15, 30, 60, 1440].map((m) => (
              <button
                key={m}
                className={`seg ${status.reminderMinutes === m ? 'seg--on' : ''}`}
                onClick={() => patch({ reminderMinutes: m })}
                disabled={busy}
              >
                {m === 1440 ? '1 day' : m === 60 ? '1 hour' : `${m} min`}
              </button>
            ))}
          </div>
        </div>

        {status.lastSyncAt && (
          <p className="panel__fine" style={{ textAlign: 'left', marginTop: 'var(--space-4)' }}>
            Last synced {new Date(status.lastSyncAt).toLocaleString()}
            {status.watchExpiresAt
              ? ` · live updates until ${new Date(status.watchExpiresAt).toLocaleDateString()}`
              : ' · polling every hour'}
          </p>
        )}
      </div>

      <div className="panel__foot panel__foot--split">
        <button className="btn" onClick={onSync} disabled={busy}>
          <Icon name="sync" size={15} className={busy ? 'anim-spin' : ''} />
          {busy ? 'Syncing…' : 'Sync now'}
        </button>
        <button className="btn btn--ghost" onClick={onDisconnect} disabled={busy}>
          Disconnect
        </button>
      </div>
    </section>
  );
}
