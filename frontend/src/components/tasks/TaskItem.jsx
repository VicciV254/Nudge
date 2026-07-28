import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import Icon from '../common/Icon.jsx';
import TaskDetail from './TaskDetail.jsx';
import { useTasks } from '../../context/TaskContext.jsx';
import { formatDue, dueTone } from '../../utils/dates.js';
import { describeRecurrence } from '../../utils/recurrence.js';

const PRIORITY_LABEL = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low' };

/**
 * A single task row.
 *
 * Tone rules from the brand system, made concrete:
 *  - Completing never makes a row vanish. It desaturates and strikes through,
 *    so the user sees the thing they just finished.
 *  - Overdue tints the *metadata*, never the whole row. A calendar full of red
 *    is the fastest way to make a productivity app feel like a punishment.
 */
function TaskItem({ task }) {
  const { toggleTask, removeTask } = useTasks();
  const [busy, setBusy] = useState(false);
  const [confirmScope, setConfirmScope] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const isRecurring = Boolean(task.seriesId);

  const onToggle = async () => {
    setBusy(true);
    await toggleTask(task.id);
    setBusy(false);
  };

  const onDelete = () => {
    // Deleting one occurrence of a series is ambiguous — ask, don't guess.
    if (isRecurring) setConfirmScope(true);
    else removeTask(task.id);
  };

  const doDelete = (scope) => {
    setConfirmScope(false);
    removeTask(task.id, scope);
  };

  const tone = dueTone(task.dueDate, task.completed);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.18 } }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={`task ${task.completed ? 'task--done' : ''} ${task._pending ? 'task--pending' : ''}`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={task.completed}
        aria-label={task.completed ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        className="task__check"
        onClick={onToggle}
        disabled={busy}
      >
        {task.completed && <Icon name="check" size={12} strokeWidth={3.4} />}
      </button>

      <button
        type="button"
        className="task__body task__body--clickable"
        onClick={() => setDetailOpen(true)}
        aria-label={`View details for "${task.title}"`}
      >
        <div className="task__title">{task.title}</div>

        <div className="task__meta">
          {task.dueDate && (
            <span className={`task__due task__due--${tone}`}>
              <Icon name="clock" size={11} strokeWidth={2.4} />
              {formatDue(task.dueDate)}
            </span>
          )}
          {task.category && <span className="task__cat">{task.category}</span>}
          {isRecurring && (
            <span className="task__repeat" title={describeRecurrence(task.recurrence) || 'Repeats'}>
              <Icon name="sync" size={11} strokeWidth={2.4} />
              Repeats
            </span>
          )}
          {task.calendarSync && (
            <span className="task__sync" title="Synced to Google Calendar">
              <Icon name="calendar" size={11} strokeWidth={2.4} />
              Calendar
            </span>
          )}
        </div>
      </button>

      {confirmScope && (
        <div className="scopeask" role="group" aria-label="Delete which occurrences?">
          <span className="scopeask__q">Delete…</span>
          <button type="button" className="btn btn--sm" onClick={() => doDelete('this')}>
            Just this one
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => doDelete('future')}>
            This and future
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => doDelete('all')}>
            All
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setConfirmScope(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {task.priority && task.priority !== 'normal' && (
        <span className={`chip chip--${task.priority} task__prio`}>
          {PRIORITY_LABEL[task.priority]}
        </span>
      )}

      <div className="task__actions">
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={onDelete}
          aria-label={`Delete "${task.title}"`}
        >
          <Icon name="trash" size={15} />
        </button>
      </div>

      <TaskDetail task={task} isOpen={detailOpen} onClose={() => setDetailOpen(false)} />
    </motion.li>
  );
}

export default memo(TaskItem);
