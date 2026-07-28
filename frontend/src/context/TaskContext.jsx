import { createContext, useContext, useReducer, useCallback, useMemo, useEffect } from 'react';
import * as taskApi from '../api/tasks.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';

/**
 * Task state.
 *
 * Mutations are optimistic: the UI updates immediately and rolls back if the
 * request fails. For a to-do app this is the difference between feeling instant
 * and feeling laggy — and completing a task is the single most-repeated action,
 * so it must never wait on a round trip.
 */

const TaskContext = createContext(null);

const initial = {
  tasks: [],
  loading: false,
  error: null,
  filter: 'all', // all | today | upcoming | overdue | completed
  search: '',
  sort: 'due', // due | created | priority
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOADING':
      return { ...state, loading: true, error: null };
    case 'ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'SET_TASKS':
      return { ...state, tasks: action.payload, loading: false, error: null };
    case 'ADD':
      return { ...state, tasks: [action.payload, ...state.tasks] };
    case 'REPLACE':
      // Swap a temporary optimistic row for the server's canonical one.
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.payload.tempId ? action.payload.task : t)),
      };
    case 'UPDATE':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.payload.id ? { ...t, ...action.payload } : t)),
      };
    case 'REMOVE':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.payload) };
    case 'RESTORE':
      return { ...state, tasks: action.payload };
    case 'SET_FILTER':
      return { ...state, filter: action.payload };
    case 'SET_SEARCH':
      return { ...state, search: action.payload };
    case 'SET_SORT':
      return { ...state, sort: action.payload };
    default:
      return state;
  }
}

const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export function TaskProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const { isAuthed } = useAuth();
  const toast = useToast();

  const fetchTasks = useCallback(async () => {
    dispatch({ type: 'LOADING' });
    try {
      const data = await taskApi.listTasks();
      dispatch({ type: 'SET_TASKS', payload: Array.isArray(data) ? data : data?.tasks || [] });
    } catch (err) {
      dispatch({ type: 'ERROR', payload: err.message });
    }
  }, []);

  useEffect(() => {
    if (isAuthed) fetchTasks();
  }, [isAuthed, fetchTasks]);

  const addTask = useCallback(
    async (data) => {
      const tempId = `tmp-${Date.now()}`;
      const optimistic = {
        id: tempId,
        completed: false,
        priority: 'normal',
        createdAt: new Date().toISOString(),
        ...data,
        _pending: true,
      };
      dispatch({ type: 'ADD', payload: optimistic });
      try {
        const saved = await taskApi.createTask(data);
        dispatch({ type: 'REPLACE', payload: { tempId, task: saved } });
        return saved;
      } catch (err) {
        dispatch({ type: 'REMOVE', payload: tempId });
        toast.error(err.message || 'Could not add that task');
        throw err;
      }
    },
    [toast]
  );

  const editTask = useCallback(
    async (id, updates, scope = 'this') => {
      const before = state.tasks.find((t) => t.id === id);
      dispatch({ type: 'UPDATE', payload: { id, ...updates } });

      // A 'future'/'all' edit also changes siblings, so mirror it locally
      // rather than leaving the list stale until the next fetch.
      if (scope !== 'this' && before?.seriesId) {
        const { completed: _c, dueDate: _d, ...shared } = updates;
        for (const t of state.tasks) {
          if (t.id !== id && t.seriesId === before.seriesId && (scope === 'all' || !t.completed)) {
            dispatch({ type: 'UPDATE', payload: { id: t.id, ...shared } });
          }
        }
      }

      try {
        return await taskApi.updateTask(id, scope === 'this' ? updates : { ...updates, scope });
      } catch (err) {
        if (before) dispatch({ type: 'UPDATE', payload: before });
        toast.error(err.message || 'Could not save that change');
        throw err;
      }
    },
    [state.tasks, toast]
  );

  const toggleTask = useCallback(
    async (id) => {
      const task = state.tasks.find((t) => t.id === id);
      if (!task) return;
      const completed = !task.completed;
      dispatch({
        type: 'UPDATE',
        payload: { id, completed, completedAt: completed ? new Date().toISOString() : null },
      });
      try {
        const saved = await taskApi.toggleTask(id, completed);
        // Completing a recurring task materialises the next occurrence
        // server-side; splice it in rather than refetching the whole list.
        if (saved?.nextInstance) {
          dispatch({ type: 'ADD', payload: saved.nextInstance });
        }
      } catch (err) {
        dispatch({ type: 'UPDATE', payload: task });
        toast.error(err.message || 'Could not update that task');
      }
    },
    [state.tasks, toast]
  );

  const removeTask = useCallback(
    async (id, scope = 'this') => {
      const snapshot = state.tasks;
      const target = state.tasks.find((t) => t.id === id);

      // Removing a whole series takes its siblings with it, so drop them from
      // the list too — otherwise rows linger until the next refetch.
      if (scope !== 'this' && target?.seriesId) {
        const doomed = new Set(
          state.tasks
            .filter((t) => t.seriesId === target.seriesId && (scope === 'all' || !t.completed))
            .map((t) => t.id)
        );
        dispatch({ type: 'RESTORE', payload: state.tasks.filter((t) => !doomed.has(t.id)) });
      } else {
        dispatch({ type: 'REMOVE', payload: id });
      }

      try {
        await taskApi.deleteTask(id, scope);
      } catch (err) {
        dispatch({ type: 'RESTORE', payload: snapshot });
        toast.error(err.message || 'Could not delete that task');
      }
    },
    [state.tasks, toast]
  );

  const setFilter = useCallback((f) => dispatch({ type: 'SET_FILTER', payload: f }), []);
  const setSearch = useCallback((s) => dispatch({ type: 'SET_SEARCH', payload: s }), []);
  const setSort = useCallback((s) => dispatch({ type: 'SET_SORT', payload: s }), []);

  // Filtering and sorting run client-side: the working set is small, and it
  // keeps filter switching instant with no spinner.
  const visibleTasks = useMemo(() => {
    const today0 = startOfToday();
    const today1 = endOfToday();
    const q = state.search.trim().toLowerCase();

    let out = state.tasks.filter((t) => {
      if (q) {
        const hay = `${t.title || ''} ${t.description || ''} ${(t.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const due = t.dueDate ? new Date(t.dueDate) : null;
      switch (state.filter) {
        case 'today':
          return !t.completed && due && due >= today0 && due <= today1;
        case 'upcoming':
          return !t.completed && due && due > today1;
        case 'overdue':
          return !t.completed && due && due < today0;
        case 'completed':
          return t.completed;
        default:
          return true;
      }
    });

    out = [...out].sort((a, b) => {
      // Open tasks always sit above completed ones.
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (state.sort === 'priority') {
        const d = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
        if (d) return d;
      }
      if (state.sort === 'created') {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
      // Default: soonest due first, undated last.
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    return out;
  }, [state.tasks, state.filter, state.search, state.sort]);

  const counts = useMemo(() => {
    const today0 = startOfToday();
    const today1 = endOfToday();
    const open = state.tasks.filter((t) => !t.completed);
    return {
      all: state.tasks.length,
      open: open.length,
      today: open.filter((t) => t.dueDate && new Date(t.dueDate) >= today0 && new Date(t.dueDate) <= today1).length,
      upcoming: open.filter((t) => t.dueDate && new Date(t.dueDate) > today1).length,
      overdue: open.filter((t) => t.dueDate && new Date(t.dueDate) < today0).length,
      completed: state.tasks.filter((t) => t.completed).length,
    };
  }, [state.tasks]);

  const value = {
    ...state,
    visibleTasks,
    counts,
    fetchTasks,
    addTask,
    editTask,
    toggleTask,
    removeTask,
    setFilter,
    setSearch,
    setSort,
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks() {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be used within a TaskProvider');
  return ctx;
}
