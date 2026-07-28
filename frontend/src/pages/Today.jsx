import TaskForm from '../components/tasks/TaskForm.jsx';
import ConflictBanner from '../components/calendar/ConflictBanner.jsx';
import TaskList from '../components/tasks/TaskList.jsx';
import Icon from '../components/common/Icon.jsx';
import { useTasks } from '../context/TaskContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { greeting } from '../utils/dates.js';
import { format } from 'date-fns';
import { useEffect } from 'react';

export default function Today() {
  const { counts, setFilter } = useTasks();
  const { user } = useAuth();

  // This page is the "today" view; scope the shared filter on mount.
  useEffect(() => { setFilter('today'); }, [setFilter]);

  const name = (user?.displayName || '').split(' ')[0];

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <div className="page__eyebrow">{format(new Date(), 'EEEE, d MMMM')}</div>
          <h1 className="page__title">
            {greeting()}{name ? `, ${name}` : ''}
          </h1>
        </div>
        {counts.overdue > 0 && (
          <div className="nudgebar">
            <Icon name="bell" size={15} />
            <span>
              <b>{counts.overdue}</b> {counts.overdue === 1 ? 'task' : 'tasks'} slipped from earlier
            </span>
            <button className="btn btn--sm btn--subtle" onClick={() => setFilter('overdue')}>
              Review
            </button>
          </div>
        )}
      </header>

      <div className="stats">
        <div className="stat">
          <span className="stat__n">{counts.today}</span>
          <span className="stat__l">Due today</span>
        </div>
        <div className="stat">
          <span className="stat__n">{counts.completed}</span>
          <span className="stat__l">Completed</span>
        </div>
        <div className="stat">
          <span className="stat__n stat__n--warn">{counts.overdue}</span>
          <span className="stat__l">Overdue</span>
        </div>
        <div className="stat">
          <span className="stat__n">{counts.upcoming}</span>
          <span className="stat__l">Upcoming</span>
        </div>
      </div>

      <ConflictBanner />
      <TaskForm />
      <TaskList />
    </div>
  );
}
