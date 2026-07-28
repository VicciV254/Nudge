import { useState } from 'react';
import Icon from '../common/Icon.jsx';
import { useTasks } from '../../context/TaskContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as cal from '../../api/calendar.js';
import { formatDue } from '../../utils/dates.js';

/**
 * Sync conflict resolver.
 *
 * The engine applies last-write-wins so the data is never stuck, but it records
 * the losing value. This surfaces that record: show both sides, mark which is
 * newer, and let the human decide. Silent LWW is how people stop trusting sync.
 */
export default function ConflictBanner() {
  const { tasks, fetchTasks } = useTasks();
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);

  const conflicts = tasks.filter((t) => t.syncStatus === 'conflict' && t.conflictData);
  if (conflicts.length === 0) return null;

  const resolve = async (task, keep) => {
    setBusyId(task.id);
    try {
      await cal.resolveConflict(task.id, keep);
      toast.success(keep === 'google' ? "Kept Google's version" : 'Kept your version');
      await fetchTasks();
    } catch (err) {
      toast.error(err.message || 'Could not resolve that conflict');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="conflicts">
      {conflicts.map((task) => {
        const c = task.conflictData;
        const googleNewer = c.winner === 'google';
        return (
          <div key={task.id} className="conflict card">
            <div className="conflict__head">
              <Icon name="alert" size={16} />
              <b>Changed in both places</b>
              <span className="chip chip--pending">Needs review</span>
            </div>

            <p className="conflict__lead">
              “{task.title}” was edited in Nudge and in Google Calendar while you were away.
            </p>

            <div className="conflict__grid">
              <div className={`conflict__side ${!googleNewer ? 'conflict__side--won' : ''}`}>
                <div className="conflict__lab">
                  <Icon name="inbox" size={12} /> In Nudge
                </div>
                <div className="conflict__v">{c.nudge?.title || '—'}</div>
                <div className="conflict__m">
                  {c.nudge?.dueDate ? formatDue(c.nudge.dueDate) : 'No due date'}
                  {!googleNewer && ' · newer'}
                </div>
              </div>

              <div className={`conflict__side ${googleNewer ? 'conflict__side--won' : ''}`}>
                <div className="conflict__lab">
                  <Icon name="calendar" size={12} /> In Google
                </div>
                <div className="conflict__v">{c.google?.title || '—'}</div>
                <div className="conflict__m">
                  {c.google?.dueDate ? formatDue(c.google.dueDate) : 'No due date'}
                  {googleNewer && ' · newer'}
                </div>
              </div>
            </div>

            <div className="conflict__act">
              <button
                className="btn btn--sm"
                onClick={() => resolve(task, 'google')}
                disabled={busyId === task.id}
              >
                Keep Google&apos;s
              </button>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => resolve(task, 'nudge')}
                disabled={busyId === task.id}
              >
                Keep mine
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
