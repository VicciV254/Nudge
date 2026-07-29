import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../components/common/Icon.jsx';
import TaskDetail from '../components/tasks/TaskDetail.jsx';
import { useTasks } from '../context/TaskContext.jsx';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
} from 'date-fns';

const SWIPE_HINT_KEY = 'nudge.calendar.swipe-hint.seen';

/**
 * Month view. Nudge-owned items carry the brand tint; the priority dot uses the
 * spread priority hues so urgent/high/normal/low stay separable at dot size.
 */
export default function Calendar() {
  const { tasks, addTask } = useTasks();
  const [searchParams, setSearchParams] = useSearchParams();
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [newTaskDate, setNewTaskDate] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('09:00');
  const [adding, setAdding] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const swipeStartX = useRef(null);

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [visibleMonth]);

  const monthStart = useMemo(() => startOfMonth(visibleMonth), [visibleMonth]);

  const byDay = useMemo(() => {
    const map = new Map();
    monthDays.forEach((d) => map.set(d.toDateString(), []));
    tasks.forEach((t) => {
      if (!t.dueDate) return;
      const d = new Date(t.dueDate);
      const key = monthDays.find((x) => isSameDay(x, d))?.toDateString();
      if (key) map.get(key).push(t);
    });
    return map;
  }, [tasks, monthDays]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  useEffect(() => {
    const deepLinkedTaskId = searchParams.get('task');
    if (!deepLinkedTaskId) return;

    const target = tasks.find((t) => t.id === deepLinkedTaskId);
    if (!target?.dueDate) {
      setSelectedTaskId(deepLinkedTaskId);
      return;
    }

    setVisibleMonth(startOfMonth(new Date(target.dueDate)));
    setSelectedTaskId(deepLinkedTaskId);
  }, [searchParams, tasks]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth > 860) return;
    if (localStorage.getItem(SWIPE_HINT_KEY) === '1') return;
    setShowSwipeHint(true);
  }, []);

  const dismissSwipeHint = () => {
    setShowSwipeHint(false);
    localStorage.setItem(SWIPE_HINT_KEY, '1');
  };

  const closeQuickAdd = () => {
    setNewTaskDate(null);
    setNewTaskTitle('');
    setNewTaskTime('09:00');
    setAdding(false);
  };

  const submitQuickAdd = async (e) => {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title || !newTaskDate) return;

    const due = new Date(newTaskDate);
    const [hh, mm] = newTaskTime.split(':').map((v) => Number(v));
    due.setHours(hh || 0, mm || 0, 0, 0);

    setAdding(true);
    try {
      await addTask({
        title,
        description: '',
        dueDate: due.toISOString(),
        priority: 'normal',
        category: null,
        calendarSync: false,
        recurrence: null,
      });
      closeQuickAdd();
    } finally {
      setAdding(false);
    }
  };

  const onDayCardClick = (date) => {
    setNewTaskDate(date);
  };

  const onDayCardKeyDown = (e, date) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onDayCardClick(date);
    }
  };

  const onGridTouchStart = (e) => {
    swipeStartX.current = e.changedTouches?.[0]?.clientX ?? null;
  };

  const onGridTouchEnd = (e) => {
    if (window.innerWidth > 860) return;

    const startX = swipeStartX.current;
    const endX = e.changedTouches?.[0]?.clientX ?? null;
    swipeStartX.current = null;

    if (startX === null || endX === null) return;
    const deltaX = endX - startX;
    const threshold = 48;

    if (Math.abs(deltaX) < threshold) return;
    dismissSwipeHint();
    if (deltaX < 0) setVisibleMonth((m) => addMonths(m, 1));
    else setVisibleMonth((m) => subMonths(m, 1));
  };

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <div className="page__eyebrow">{format(monthStart, 'MMMM yyyy')}</div>
          <h1 className="page__title">Calendar</h1>
        </div>
        <div className="calnav">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setVisibleMonth((m) => subMonths(m, 1))}
            aria-label="Previous month"
          >
            <Icon name="chevron-left" size={14} />
            Prev
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setVisibleMonth(startOfMonth(new Date()))}
          >
            Today
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
          >
            Next
            <Icon name="chevron-right" size={14} />
          </button>
          <span className="chip chip--ok"><Icon name="sync" size={12} /> Synced</span>
        </div>
      </header>

      <div className="month">
        {showSwipeHint && (
          <div className="swipehint" role="note" aria-live="polite">
            <span className="swipehint__text">Swipe left or right to change month</span>
            <button type="button" className="btn btn--ghost btn--icon" onClick={dismissSwipeHint} aria-label="Dismiss swipe hint">
              <Icon name="x" size={14} />
            </button>
          </div>
        )}

        <div className="month__head" aria-hidden="true">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dow) => (
            <span key={dow} className="month__dow">{dow}</span>
          ))}
        </div>

        <div className="month__grid" onTouchStart={onGridTouchStart} onTouchEnd={onGridTouchEnd}>
          {monthDays.map((d) => {
            const items = byDay.get(d.toDateString()) || [];
            const today = isSameDay(d, new Date());
            const inCurrentMonth = isSameMonth(d, monthStart);
            return (
              <div
                key={d.toISOString()}
                className={`monthday ${today ? 'monthday--today' : ''} ${inCurrentMonth ? '' : 'monthday--muted'}`}
                role="button"
                tabIndex={0}
                onClick={() => onDayCardClick(d)}
                onKeyDown={(e) => onDayCardKeyDown(e, d)}
                aria-label={`Add a task on ${format(d, 'EEEE, d MMMM')}`}
              >
                <div className="monthday__h monthday__h--btn">
                  <span className="monthday__num">{format(d, 'd')}</span>
                  <span className="monthday__add">Add</span>
                </div>

                <div className="monthday__body">
                  {items.length === 0 && <span className="monthday__empty">—</span>}
                  {items.slice(0, 4).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`wevt wevt--btn ${t.completed ? 'wevt--done' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTaskId(t.id);
                        const next = new URLSearchParams(searchParams);
                        next.set('task', t.id);
                        setSearchParams(next, { replace: true });
                      }}
                      aria-label={`View details for "${t.title}"`}
                    >
                      <span className={`wdot wdot--${t.priority || 'normal'}`} />
                      <span className="wevt__t">{t.title}</span>
                    </button>
                  ))}
                  {items.length > 4 && <span className="monthday__more">+{items.length - 4} more</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TaskDetail
        task={selectedTask}
        isOpen={Boolean(selectedTask)}
        onClose={() => {
          setSelectedTaskId(null);
          if (!searchParams.get('task')) return;
          const next = new URLSearchParams(searchParams);
          next.delete('task');
          setSearchParams(next, { replace: true });
        }}
      />

      {newTaskDate && (
        <div className="calquick" role="dialog" aria-modal="true" aria-labelledby="calquick-title">
          <button type="button" className="calquick__backdrop" onClick={closeQuickAdd} aria-label="Close" />
          <form className="calquick__card" onSubmit={submitQuickAdd}>
            <div className="calquick__head">
              <h2 id="calquick-title">Add task for {format(newTaskDate, 'EEE, d MMM')}</h2>
              <button type="button" className="btn btn--ghost btn--icon" onClick={closeQuickAdd} aria-label="Close">
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="calquick-title-input">Task title</label>
              <input
                id="calquick-title-input"
                className="input"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="What do you need to do?"
                autoFocus
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="calquick-time-input">Time</label>
              <input
                id="calquick-time-input"
                type="time"
                className="input"
                value={newTaskTime}
                onChange={(e) => setNewTaskTime(e.target.value)}
              />
            </div>
            <div className="calquick__foot">
              <button type="button" className="btn btn--ghost" onClick={closeQuickAdd} disabled={adding}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={adding || !newTaskTitle.trim()}>
                {adding ? 'Adding…' : 'Add task'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
