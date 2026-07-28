import { useState, useRef, useEffect } from 'react';
import Icon from '../common/Icon.jsx';
import RepeatPicker from './RepeatPicker.jsx';
import { useTasks } from '../../context/TaskContext.jsx';
import { PRIORITIES, CATEGORIES } from '../../utils/constants.js';
import { taskIssues } from '../../utils/validators.js';

/**
 * Quick-add. Collapsed it is a single input; it only expands once the user
 * commits to typing. Adding a task should never feel like filling in a form.
 */
export default function TaskForm() {
  const { addTask } = useTasks();
  const [open, setOpen] = useState(false);
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

  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const reset = () => {
    setForm({
      title: '',
      description: '',
      dueDate: '',
      priority: 'normal',
      category: '',
      calendarSync: false,
      recurrence: null,
    });
    setErrors({});
  };

  const submit = async (e) => {
    e.preventDefault();
    const issues = taskIssues(form);
    if (form.recurrence && !form.dueDate) {
      issues.dueDate = 'A repeating task needs a first date';
    }
    setErrors(issues);
    if (Object.keys(issues).length) return;

    setSaving(true);
    try {
      await addTask({
        ...form,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        category: form.category || null,
        recurrence: form.recurrence || null,
      });
      reset();
      setOpen(false);
    } catch {
      /* toast already surfaced by the context */
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      reset();
    }
    // Cmd/Ctrl+Enter submits from anywhere in the form.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e);
  };

  return (
    <form className={`taskform ${open ? 'taskform--open' : ''}`} onSubmit={submit} onKeyDown={onKeyDown}>
      <div className="taskform__row">
        <span className="taskform__plus" aria-hidden="true">
          <Icon name="plus" size={17} strokeWidth={2.6} />
        </span>
        <input
          ref={titleRef}
          className="taskform__title"
          placeholder="Add a task…"
          value={form.title}
          onChange={(e) => {
            set('title', e.target.value);
            // Expand on intent (typing), not on focus. Expanding on focus put
            // ~18 tab stops between the keyboard user and their first task.
            if (e.target.value && !open) setOpen(true);
          }}
          onClick={() => setOpen(true)}
          aria-label="Task name"
          aria-expanded={open}
          aria-invalid={Boolean(errors.title)}
        />
        {open && (
          <button
            type="submit"
            className="btn btn--sm"
            disabled={saving || !form.title.trim()}
          >
            {saving ? 'Adding…' : 'Add'}
          </button>
        )}
      </div>

      {errors.title && <div className="field__error taskform__err">{errors.title}</div>}

      {open && (
        <div className="taskform__detail anim-in">
          <textarea
            className="textarea taskform__desc"
            placeholder="Notes (optional)"
            rows={2}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            aria-label="Notes"
          />

          <div className="taskform__grid">
            <div className="field">
              <label className="field__label" htmlFor="tf-due">Due</label>
              <input
                id="tf-due"
                type="datetime-local"
                className="input"
                value={form.dueDate}
                onChange={(e) => set('dueDate', e.target.value)}
                aria-invalid={Boolean(errors.dueDate)}
              />
              {errors.dueDate && <span className="field__error">{errors.dueDate}</span>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="tf-cat">Category</label>
              <select
                id="tf-cat"
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
              Add to Google Calendar
            </span>
          </label>

          <div className="taskform__foot">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => { setOpen(false); reset(); }}
            >
              Cancel
            </button>
            <span className="taskform__hint">⌘↵ to save</span>
          </div>
        </div>
      )}
    </form>
  );
}
