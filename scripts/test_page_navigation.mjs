import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createPageStateStore, pageStateStore, clearPageState } from '../admin/src/utils/pageStateStore.js';
import { usePageState } from '../admin/src/utils/usePageState.js';
import { clearApiCache } from '../admin/src/utils/apiFetch.js';
const require = createRequire(new URL('../admin/package.json', import.meta.url));
const React = require('react');
const { renderToString } = require('react-dom/server');
const user = { id: 1, token: 'session-a', clinic_id: 1, role: 'doctor', permissions: {} };

function Page({ name = 'patients', result, refresh = false, account = user }) {
  const [rows, setRows] = usePageState(account, `${name}:rows`, []);
  const [loading, setLoading] = usePageState(account, `${name}:loading`, true, 'loading');
  const applied = React.useRef(false);
  if (!applied.current && (result !== undefined || refresh)) {
    applied.current = true;
    if (result !== undefined) { setRows(result); setLoading(false); }
    else setLoading(true);
  }
  return React.createElement('span', null, loading ? 'Loading...' : JSON.stringify(rows));
}
const render = props => renderToString(React.createElement(Page, props));
assert.match(render({}), /Loading/);
assert.match(render({ result: ['Milo'] }), /Milo/);
// Navigate away, then remount the page (a fresh React component instance).
assert.match(render({ name: 'billing', result: ['Invoice 1'] }), /Invoice 1/);
assert.match(render({}), /Milo/);
assert.doesNotMatch(render({ refresh: true }), /Loading/, 'refresh keeps prior results visible');
clearApiCache();
assert.match(render({}), /Milo/, 'live/request cache invalidation does not blank page state');
assert.match(render({ result: ['Milo', 'Luna'] }), /Luna/, 'fresh results replace the snapshot');
assert.doesNotMatch(render({ name: 'empty', result: [] }), /Loading/);
assert.doesNotMatch(render({ name: 'empty', refresh: true }), /Loading/, 'empty loaded pages also stay ready');
assert.match(render({ account: { ...user, clinic_id: 2 } }), /Loading/, 'other clinics cannot see old data');
assert.match(render({ account: { ...user, token: 'session-b' } }), /Loading/, 'other sessions cannot see old data');
assert.match(render({ account: { ...user, permissions: { updated: true } } }), /Loading/, 'permission changes reset snapshots');
clearPageState();
assert.match(render({}), /Loading/, 'logout clears snapshots');

const isolated = createPageStateStore();
const old = isolated.open(user, 'rows');
old.write(['old']);
isolated.clear();
old.write(['late response']);
assert.deepEqual(isolated.open(user, 'rows').read([]), [], 'late responses cannot revive cleared snapshots');
assert.deepEqual(isolated.open(user, 'rows').read(() => ['wrong']), [], 'lazy defaults do not replace loaded empty data');
console.log('PASS: real React remounts restore page data immediately; refresh, empty results, cache invalidation, account/clinic/permission changes, logout, and late responses');
