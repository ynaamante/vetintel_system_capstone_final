import catalog from '../../../data/permissionCatalog.json';
import { canViewFeature, permissionAvailable, roleProfile } from '../utils/permissionUtils';

const sidebarSections = [
  ['Disease Intelligence', ['Intelligence Dashboard', 'Disease Monitoring', 'Risk Monitoring', 'Reports']],
  ['Clinic Management', ['Client Management', 'Audit Trail']],
  ['Clinical Records', ['My Schedule', 'Patient Intakes', 'Local Clinic Records', 'Patient Records', 'Due Dates & Reminders']],
  ['Operations', Object.keys(catalog.operationsPageViews)],
  ['Communication', ['Shared Inbox']],
];

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
  const profile = roleProfile(role);
  const configuredPages = catalog.pagePermissions[profile] || [];
  const operations = profile === 'doctor' ? catalog.pagePermissions.receptionist.filter(page => Object.hasOwn(catalog.operationsPageViews, page.label)) : [];
  const pages = [...configuredPages, ...operations].map(filter).filter(Boolean);
  // Include all other supported pages without dropping existing configurable actions.
  for (const [label, items] of catalog.groups) {
    const actions = items.filter(item => !used.has(item) && permissionAvailable(role, item));
    if (actions.length) pages.push({ label, actions, children: [] });
  }
  return pages;
}

export const pageActions = node => [...new Set([...(node.actions || []), ...(node.children || []).flatMap(pageActions)])];
export const visibleActions = role => [...new Set(permissionPages(role).flatMap(pageActions))];

function sidebarPages(role, configuredPages) {
  const primarySection = roleProfile(role) === 'doctor' ? 'Clinical Records' : 'Operations';
  const orderedSections = [...sidebarSections.filter(([section]) => section === primarySection), ...sidebarSections.filter(([section]) => section !== primarySection)];
  return orderedSections.flatMap(([section, names]) => {
    const pages = names.flatMap(feature => {
      if (section === 'Clinical Records' && roleProfile(role) !== 'doctor' && feature !== 'Local Clinic Records') return [];
      const [, view, ...featureActions] = catalog.features[feature];
      if (!permissionAvailable(role, view)) return [];
      const configured = configuredPages.find(page => page.label === feature);
      const pagePermission = catalog.operationsPageViews[feature] || view;
      const relatedActions = feature === 'Reports' ? [...featureActions, 'Export Reports'] : featureActions;
      const actions = [...new Set(configured?.actions || relatedActions)].filter(item => item && item !== pagePermission && item !== view && permissionAvailable(role, item));
      return [{ feature, label: feature === 'Intelligence Dashboard' ? 'Dashboard' : feature, view, pagePermission, actions, children: configured?.children || [] }];
    });
    return pages.length ? [{ section, pages }] : [];
  });
}

export function updateActions(permissions, items, enabled) {
  const next = structuredClone(permissions);
  for (const item of items) {
    const group = groupFor(item);
    if (group) next[group] = { ...next[group], [item]: enabled };
  }
  return next;
}

export default function RolePermissionTree({ role, permissions, onChange }) {
  const sections = sidebarPages(role, permissionPages(role));
  const shownPermissions = new Set(sections.flatMap(({ pages }) => pages.flatMap(page => [page.pagePermission, page.view, ...pageActions(page)])));
  const additionalGroups = catalog.groups.flatMap(([label, items]) => {
    const actions = items.filter(item => permissionAvailable(role, item) && !shownPermissions.has(item));
    return actions.length ? [{ label, actions, children: [] }] : [];
  });

  const renderActions = (node, label = node.label) => {
    const items = pageActions(node);
    const count = items.filter(item => permissionValue(permissions, item)).length;
    return <details key={node.label} className="role-permission-details">
      <summary>{label}<span className="role-permission-count">{count} of {items.length} enabled</span></summary>
      {node.actions.length > 0 && <div className="role-permission-options">
        {node.actions.map(item => <label key={item}>
          <input type="checkbox" checked={permissionValue(permissions, item)} disabled={!onChange} onChange={event => onChange?.(updateActions(permissions, [item], event.target.checked))} />
          {item}
        </label>)}
      </div>}
      {node.children.map(child => renderActions(child))}
    </details>;
  };

  return <div className="role-permission-tree">
    {sections.map(({ section, pages }) => <section key={section} className="role-permission-section">
      <h3>{section}</h3>
      {onChange && section === 'Operations' && roleProfile(role) === 'doctor' && <p>Enable these pages if this role also covers reception.</p>}
      {pages.map(page => {
        const enabled = canViewFeature(permissions, role, page.feature);
        return <div key={page.feature} className="role-permission-page">
          <div className="role-permission-page-header">
            <strong>{page.label}</strong>
            {onChange ? <label className="role-permission-page-toggle">
              <input type="checkbox" aria-label={'Allow opening ' + page.label} checked={enabled} onChange={event => {
                const checked = event.target.checked;
                const items = checked ? [page.pagePermission, page.view] : [page.pagePermission];
                onChange(updateActions(permissions, items, checked));
              }} /> Page access
            </label> : <span>{enabled ? 'Page access on' : 'Page access off'}</span>}
          </div>
          {pageActions(page).length > 0 && renderActions(page, 'Actions and tabs')}
        </div>;
      })}
    </section>)}
    {additionalGroups.length > 0 && <details className="role-permission-details role-permission-advanced">
      <summary>Additional permissions</summary>
      {additionalGroups.map(node => renderActions(node))}
    </details>}
  </div>;
}
