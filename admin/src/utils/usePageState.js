import { useCallback, useMemo, useState } from 'react';
import { pageStateStore } from './pageStateStore.js';

// Restore data on the first render, while the page's usual effect refreshes it.
// Only data/filters use this hook: dialogs, submissions, and forms stay local.
export function usePageState(user, key, initial, mode) {
  const identity = JSON.stringify([user?.token, user?.id, user?.clinic_id, user?.role, user?.permissions]);
  // identity includes all account/permission inputs used by the store.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entry = useMemo(() => pageStateStore.open(user, key), [identity, key]);
  const [state, setState] = useState(() => ({ entry, value: entry.read(initial) }));
  const value = state.entry === entry ? state.value : entry.read(initial);
  const setValue = useCallback(update => {
    setState(current => {
      const previous = current.entry === entry ? current.value : entry.read(initial);
      let next = typeof update === 'function' ? update(previous) : update;
      // Refreshes keep the loaded content visible, including empty results.
      if (mode === 'loading' && previous === false && next === true) next = false;
      entry.write(next);
      return { entry, value: next };
    });
  // Initial values are only consulted when the account/page key changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, mode]);
  return [value, setValue];
}
