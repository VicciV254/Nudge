import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../common/Icon.jsx';
import RepeatPicker from './RepeatPicker.jsx';
import { useTasks } from '../../context/TaskContext.jsx';
import { PRIORITIES, CATEGORIES } from '../../utils/constants.js';
import { taskIssues } from '../../utils/validators.js';
import { formatDue, dueTone } from '../../utils/dates.js';
import { describeRecurrence } from '../../utils/recurrence.js';

const PRIORITY_LABEL = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low' };

/**
 * Task detail modal for viewing and editing task information.
 * Opens as a full-screen overlay on mobile, side panel on desktop.
 */
export default function TaskDetail({ task, isOpen, onClose }) {
  const { editTask } = useTasks();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'normal',
    category: '',
    calendarSync: false,
    recurrence: null,
  });
  const titleRef = useRef(null);

  // Initialize form when task changes
  useEffect(() => {
    if (task) {
      const dueISO = task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '';
      setForm({
        title: task.title || '',
        description: task.description || '',
        dueDate: dueISO,
        priority: task.priority || 'normal',
        category: task.category || '',
        calendarSync: task.calendarSync || false,
        recurrence: task.recurrence || null,
      });
      setErrors({});
    }
  }, [task, isOpen]);

  useEffect(() => {
    if (isEditing) titleRef.current?.focus();
  }, [isEditing]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    const issues = taskIssues(form);
    if (form.recurrence && !form.dueDate) {
      issues.dueDate = 'A repeating task needs a first date';
    }
    setErrors(issues);
    if (Object.keys(issues).length) return;

    setSaving(true);
    try {
      await editTask(task.id, {
        title: form.title,
        description: form.description,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        priority: form.priority,
        category: form.category || null,
        calendarSync: form.calendarSync,
        recurrence: form.recurrence || null,
      });
      setIsEditing(false);
    } catch {
      /* toast already surfaced by the context */
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form to current task state
    if (task) {
      const dueISO = task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '';
      setForm({
        title: task.title || '',
        description: task.description || '',
        dueDate: dueISO,
        priority: task.priority || 'normal',
        category: task.category || '',
        calendarSync: task.calendarSync || false,
        recurrence: task.recurrence || null,
      });
      setErrors({});
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (isEditing) handleCancel();
      else onClose();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave(e);
  };

  if (!task) return null;

  const tone = dueTone(task.dueDate, task.completed);
  const isRecurring = Boolean(task.seriesId);
  const portalElement = typeof document !== 'undefined' ? document.body : null;

  if (!isOpen || !portalElement) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="modal__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            className="modal task-detail"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-labelledby="task-detail-title"
            aria-modal="true"
            onKeyDown={onKeyDown}
          >
            {/* Header */}
            <div className="modal__header">
              <h2 id="task-detail-title" className="modal__title">
                {isEditing ? 'Edit task' : 'Task details'}
              </h2>
              <button
                type="button"
                className="btn btn--ghost btn--icon"
                onClick={onClose}
                aria-label="Close"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="modal__content">
              {!isEditing && (
                // View mode
                <div className="task-detail__view">
                  <div className="task-detail__title">{task.title}</div>

                  {task.description && (
                    <div className="task-detail__section">
                      <h3 className="task-detail__label">Notes</h3>
                      <p className="task-detail__desc">{task.description}</p>
                    </div>
                  )}

                  <div className="task-detail__grid">
                    {task.dueDate && (
                      <div className="task-detail__item">
                        <span className="task-detail__label">Due</span>
                        <span className={`task-detail__value task-detail__value--${tone}`}>
                          <Icon name="clock" size={13} strokeWidth={2} />
                          {formatDue(task.dueDate)}
                        </span>
                      </div>
                    )}

                    {task.priority && task.priority !== 'normal' && (
                      <div className="task-detail__item">
                        <span className="task-detail__label">Priority</span>
                        <span className={`chip chip--${task.priority}`}>
                          {PRIORITY_LABEL[task.priority]}
                        </span>
                      </div>
                    )}

                    {task.category && (
                      <div className="task-detail__item">
                        <span className="task-detail__label">Category</span>
                        <span className="task-detail__value">{task.category}</span>
                      </div>
                    )}

                    {isRecurring && (
                      <div className="task-detail__item">
                        <span className="task-detail__label">Repeats</span>
                        <span className="task-detail__value">
                          {describeRecurrence(task.recurrence) || 'Repeats'}
                        </span>
                      </div>
                    )}

                    {task.calendarSync && (
                      <div className="task-detail__item">
                        <span className="task-detail__label">Calendar</span>
                        <span className="task-detail__value">
                          <Icon name="calendar" size={13} strokeWidth={2} />
                          Synced to Google Calendar
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="task-detail__meta">
                    <small>Created {new Date(task.createdAt).toLocaleDateString()}</small>
                    {task.completedAt && (
                      <small>Completed {new Date(task.completedAt).toLocaleDateString()}</small>
                    )}
                  </div>
                </div>
              )}

              {isEditing && (
                // Edit mode
                <form className="task-detail__edit" onSubmit={handleSave} onKeyDown={onKeyDown}>
                  <div className="field">
                    <label className="field__label" htmlFor="td-title">Title</label>
                    <input
                      ref={titleRef}
                      id="td-title"
                      type="text"
                      className="input"
                      value={form.title}
                      onChange={(e) => set('title', e.target.value)}
                      aria-invalid={Boolean(errors.title)}
                    />
                    {errors.title && <span className="field__error">{errors.title}</span>}
                  </div>

                  <div className="field">
                    <label className="field__label" htmlFor="td-desc">Notes</label>
                    <textarea
                      id="td-desc"
                      className="textarea"
                      rows={3}
                      value={form.description}
                      onChange={(e) => set('description', e.target.value)}
                      placeholder="Add notes (optional)"
                    />
                  </div>

                  <div className="task-detail__grid">
                    <div className="field">
                      <label className="field__label" htmlFor="td-due">Due</label>
                      <input
                        id="td-due"
                        type="datetime-local"
                        className="input"
                        value={form.dueDate}
                        onChange={(e) => set('dueDate', e.target.value)}
                        aria-invalid={Boolean(errors.dueDate)}
                      />
                      {errors.dueDate && <span className="field__error">{errors.dueDate}</span>}
                    </div>

                    <div className="field">
                      <label className="field__label" htmlFor="td-cat">Category</label>
                      <select
                        id="td-cat"
                        className="select"
                        value={form.category}
                        onChange={(e) => set('category', e.target.value)}
                      >
                        <option value="">None</option>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="field">
                    <span className="field__label">Priority</span>
                    <div className="segs" role="radiogroup" aria-label="Priority">
                      {PRIORITIES.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          role="radio"
                          aria-checked={form.priority === p.value}
                          className={`seg ${form.priority === p.value ? 'seg--on' : ''}`}
                          onClick={() => set('priority', p.value)}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <RepeatPicker
                    value={form.recurrence}
                    onChange={(v) => set('recurrence', v)}
                    dueDate={form.dueDate}
                  />

                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={form.calendarSync}
                      onChange={(e) => set('calendarSync', e.target.checked)}
                    />
                    <span className="toggle__track" aria-hidden="true"><span className="toggle__dot" /></span>
                    <span className="toggle__label">
                      <Icon name="calendar" size={14} />
                      Sync to Google Calendar
                    </span>
                  </label>
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="modal__footer">
              {!isEditing ? (
                <>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={onClose}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setIsEditing(true)}
                  >
                    <Icon name="edit" size={14} />
                    Edit
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={handleSave}
                    disabled={saving || !form.title.trim()}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    portalElement
  );
}
