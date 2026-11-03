const MAX_HISTORY = 100;

export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  /** Consecutive edits with the same key merge into one undo step, such as dragging a colour picker. */
  groupKey: string | null;
};

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], groupKey: null };
}

export function applyEdit<T>(history: History<T>, next: T, groupKey: string | null = null): History<T> {
  if (groupKey !== null && groupKey === history.groupKey) {
    return { ...history, present: next, future: [] };
  }
  return {
    past: [...history.past, history.present].slice(-MAX_HISTORY),
    present: next,
    future: [],
    groupKey,
  };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    groupKey: null,
  };
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future;
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
    groupKey: null,
  };
}
