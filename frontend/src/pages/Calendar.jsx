import { useMemo } from 'react';
import Icon from '../components/common/Icon.jsx';
import { useTasks } from '../context/TaskContext.jsx';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';

/**
 * Week view. Nudge-owned items carry the brand tint; the priority dot uses the
 * spread priority hues so urgent/high/normal/low stay separable at dot size.
 */
export default function Calendar() {
  const { tasks } = useTasks();
  const days = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, []);

  const byDay = useMemo(() => {
    const map = new Map();
    days.forEach((d) => map.set(d.toDateString(), []));
    tasks.forEach((t) => {
      if (!t.dueDate) return;
      const d = new Date(t.dueDate);
      const key = days.find((x) => isSameDay(x, d))?.toDateString();
      if (key) map.get(key).push(t);
    });
    return map;
  }, [tasks, days]);

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <div className="page__eyebrow">Week of {format(days[0], 'd MMM')}</div>
          <h1 className="page__title">Calendar</h1>
        </div>
        <span className="chip chip--ok"><Icon name="sync" size={12} /> Synced</span>
      </header>

      <div className="week">
        {days.map((d) => {
          const items = byDay.get(d.toDateString()) || [];
          const today = isSameDay(d, new Date());
          return (
            <div key={d.toISOString()} className={`weekday ${today ? 'weekday--today' : ''}`}>
              <div className="weekday__h">
                <span className="weekday__dow">{format(d, 'EEE')}</span>
                <span className="weekday__num">{format(d, 'd')}</span>
              </div>
              <div className="weekday__body">
                {items.length === 0 && <span className="weekday__empty">—</span>}
                {items.map((t) => (
                  <div key={t.id} className={`wevt ${t.completed ? 'wevt--done' : ''}`}>
                    <span className={`wdot wdot--${t.priority || 'normal'}`} />
                    <span className="wevt__t">{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
