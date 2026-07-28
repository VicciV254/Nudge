import TaskForm from '../components/tasks/TaskForm.jsx';
import ConflictBanner from '../components/calendar/ConflictBanner.jsx';
import TaskFilters from '../components/tasks/TaskFilters.jsx';
import TaskList from '../components/tasks/TaskList.jsx';
import { useTasks } from '../context/TaskContext.jsx';
import { useEffect } from 'react';

export default function Tasks() {
  const { counts, setFilter, filter } = useTasks();
  useEffect(() => { if (filter === 'today') setFilter('all'); }, []); // eslint-disable-line

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <div className="page__eyebrow">{counts.open} open · {counts.completed} done</div>
          <h1 className="page__title">All tasks</h1>
        </div>
      </header>
      <ConflictBanner />
      <TaskForm />
      <TaskFilters />
      <TaskList />
    </div>
  );
}
