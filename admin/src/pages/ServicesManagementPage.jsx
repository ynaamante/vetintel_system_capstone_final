import { useEffect, useState } from 'react';
import Topbar from '../components/Topbar';
import SharedInventoryPanel from '../components/SharedInventoryPanel';
import SharedServicesCatalog from '../components/SharedServicesCatalog';
import { canViewFeature } from '../utils/permissionUtils';

export default function ServicesManagementPage({ user, initialTab = 'services', setPage }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const isOwner = ['owner', 'clinic_owner'].includes(String(user.role || '').toLowerCase());
  const canViewServices = isOwner || canViewFeature(user.permissions, user.role, 'Services Management');
  const canViewInventory = isOwner || canViewFeature(user.permissions, user.role, 'Inventory Management');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const selectTab = (tab) => {
    setActiveTab(tab);
    setPage?.(tab === 'inventory' ? 'inventory' : 'services');
  };

  const sectionTabs = (<nav className="services-management-tabs" aria-label="Services management sections">
              {[
                { id: 'services', label: 'Services', canView: canViewServices },
                { id: 'inventory', label: 'Inventory', canView: canViewInventory },
              ].filter(tab => tab.canView).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                  className={activeTab === tab.id ? 'active' : ''}
                  onClick={() => selectTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>);

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f4f7fa' }}>
      <Topbar
        user={user}
        title="Services Management"
        subtitle="Manage clinic services, inventory, and pricing in one place"
      />
      <div style={{ padding: '22px 24px' }}>
        {(canViewServices || canViewInventory) ? (
          <div className="services-management-page">
            {activeTab === 'inventory'
              ? canViewInventory
                ? <>{sectionTabs}<SharedInventoryPanel user={user} /></>
                : <p>You do not have permission to view inventory.</p>
              : canViewServices
                ? <SharedServicesCatalog user={user} sectionTabs={sectionTabs} />
                : <p>You do not have permission to view services.</p>}
          </div>
        ) : (
          <p>You do not have permission to view services or inventory.</p>
        )}
      </div>
    </div>
  );
}
