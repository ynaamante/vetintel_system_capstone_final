// Page snapshots survive navigation, but only for the current signed-in account.
export function createPageStateStore() {
  let principal;
  let generation = 0;
  const values = new Map();
  const written = new Set();
  const clear = () => { values.clear(); written.clear(); generation += 1; };
  return {
    clear,
    status(key) { return { value: values.get(key), written: written.has(key) }; },
    open(user, key) {
      const identity = JSON.stringify([user?.token, user?.id, user?.clinic_id, user?.role, user?.permissions]);
      if (identity !== principal) { clear(); principal = identity; }
      const version = generation;
      return {
        read(initial) {
          if (!values.has(key)) {
            if (values.size >= 500) {
              const oldest = values.keys().next().value;
              values.delete(oldest);
              written.delete(oldest);
            }
            values.set(key, typeof initial === 'function' ? initial() : initial);
          }
          return values.get(key);
        },
        write(value) {
          if (version === generation) { values.set(key, value); written.add(key); }
        },
      };
    },
  };
}

export const pageStateStore = createPageStateStore();
export const clearPageState = pageStateStore.clear;
