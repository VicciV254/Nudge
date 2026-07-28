import { AnimatePresence } from 'framer-motion';
import TaskItem from './TaskItem.jsx';
import Icon from '../common/Icon.jsx';
import { Mark } from '../common/Logo.jsx';
import { useTasks } from '../../context/TaskContext.jsx';

function EmptyState({ filter }) {
  const copy = {
    all: { t: 'Nothing here yet', s: 'Add your first task and Nudge will keep it moving.' },
    today: { t: 'Nothing due today', s: 'Enjoy it — or pull something forward from Upcoming.' },
    upcoming: { t: 'Nothing scheduled', s: 'Tasks with a future due date will appear here.' },
    overdue: { t: 'Nothing overdue', s: "You're all caught up. Genuinely nice work." },
    completed: { t: 'Nothing finished yet', s: 'Completed tasks stay here so you can see progress.' },
  }[filter] || { t: 'Nothing here', s: '' };

  return (
    <div className="empty">
      <Mark size={44} />
      <div className="empty__t">{copy.t}</div>
      <p className="empty__s">{copy.s}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <ul className="tasks" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="task task--skel">
          <span className="skel skel--box" />
          <div className="task__body">
            <span className="skel skel--line" style={{ width: `${60 + i * 8}%` }} />
            <span className="skel skel--line skel--sm" style={{ width: '30%' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function TaskList() {
  const { visibleTasks, loading, error, filter, fetchTasks } = useTasks();

  if (loading && visibleTasks.length === 0) return <Skeleton />;

  if (error) {
    return (
      <div className="empty">
        <span className="empty__icon empty__icon--err">
          <Icon name="alert" size={22} />
        </span>
        <div className="empty__t">Couldn&apos;t load your tasks</div>
        <p className="empty__s">{error}</p>
        <button className="btn btn--subtle" onClick={fetchTasks}>
          <Icon name="sync" size={15} />
          Try again
        </button>
      </div>
    );
  }

  if (visibleTasks.length === 0) return <EmptyState filter={filter} />;

  return (
    <ul className="tasks">
      <AnimatePresence initial={false}>
        {visibleTasks.map((t) => (
          <TaskItem key={t.id} task={t} />
        ))}
      </AnimatePresence>
    </ul>
  );
}
