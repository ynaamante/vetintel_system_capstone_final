import catalog from '../../../data/permissionCatalog.json';
import { permissionAvailable, roleProfile } from '../utils/permissionUtils';

const groupFor = item => catalog.groups.find(([, items]) => items.includes(item))?.[0];
export const permissionValue = (permissions, item) => permissions?.[groupFor(item)]?.[item] === true;

export function permissionPages(role) {
  const used = new Set();
  const filter = node => {
    const actions = (node.actions || []).filter(item => permissionAvailable(role, item));
    actions.forEach(item => used.add(item));
    const children = (node.children || []).map(filter).filter(Boolean);
    return actions.length || children.length ? { ...node, actions, children } : null;
  };
  const pages = (catalog.pagePermissions[roleProfile(role)] || []).map(filter).filter(Boolean);
  // Include all other supported pages without dropping existing configurable actions.
  for (const [label, items] of catalog.groups) {
    const actions = items.filter(item => !used.has(item) && permissionAvailable(role, item));
    if (actions.length) pages.push({ label, actions, children: [] });
  }
  return pages;
}

export const pageActions = node => [...new Set([...(node.actions || []), ...(node.children || []).flatMap(pageActions)])];
export const visibleActions = role => [...new Set(permissionPages(role).flatMap(pageActions))];

export function updateActions(permissions, items, enabled) {
  const next = structuredClone(permissions);
  for (const item of items) {
    const group = groupFor(item);
    if (group) next[group] = { ...next[group], [item]: enabled };
  }
  return next;
}

export default function RolePermissionTree({ role, permissions, onChange }) {
  const render = (node, path) => {
    const items = pageActions(node);
    const count = items.filter(item => permissionValue(permissions, item)).length;
    return <details key={path} open style={{ border: '1px solid #d7e3e8', borderRadius: 9, margin: '10px 0', padding: '10px 12px', background: '#fff' }}>
      <summary style={{ cursor: 'pointer', color: '#203d36', fontWeight: 650 }}>
        {onChange && <input type="checkbox" aria-label={`Select all permissions for ${node.label}`} checked={count === items.length} ref={element => { if (element) element.indeterminate = count > 0 && count < items.length; }} onClick={event => event.stopPropagation()} onChange={() => onChange(updateActions(permissions, items, count !== items.length))} style={{ marginRight: 8 }} />}
        {node.label}<span style={{ float: 'right', fontWeight: 400, fontSize: 12 }}>{count}/{items.length}</span>
      </summary>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px 16px', paddingTop: node.actions.length ? 14 : 0 }}>
        {node.actions.map(item => <label key={item} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#40514d' }}>
          <input type="checkbox" checked={permissionValue(permissions, item)} disabled={!onChange} onChange={event => onChange?.(updateActions(permissions, [item], event.target.checked))} />{item}
        </label>)}
      </div>
      {node.children.map((child, index) => render(child, `${path}/${index}`))}
    </details>;
  };
  return <div>{permissionPages(role).map((node, index) => render(node, String(index)))}</div>;
}
