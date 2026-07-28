import Icon from '../common/Icon.jsx';
import { useTasks } from '../../context/TaskContext.jsx';
import { FILTERS } from '../../utils/constants.js';

export default function TaskFilters() {
  const { filter, setFilter, search, setSearch, counts } = useTasks();

  return (
    <div className="filters">
      <div className="filters__tabs" role="tablist" aria-label="Filter tasks">
        {FILTERS.map((f) => {
          const n = counts[f.value] ?? 0;
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              role="tab"
              aria-selected={active}
              className={`ftab ${active ? 'ftab--on' : ''}`}
              onClick={() => setFilter(f.value)}
            >
              <Icon name={f.icon} size={14} strokeWidth={2.2} />
              {f.label}
              {n > 0 && <span className="ftab__n">{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="filters__search">
        <Icon name="search" size={15} className="filters__searchicon" />
        <input
          className="input filters__input"
          type="search"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search tasks"
        />
      </div>
    </div>
  );
}
