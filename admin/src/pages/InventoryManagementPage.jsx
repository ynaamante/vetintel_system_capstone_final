import Topbar from '../components/Topbar';
import SharedInventoryPanel from '../components/SharedInventoryPanel';
import { canViewFeature } from '../utils/permissionUtils';
export default function InventoryManagementPage({user}) {
  const canView = ['owner','clinic_owner'].includes(String(user.role||'').toLowerCase()) || canViewFeature(user.permissions,user.role,'Inventory Management');
  return <div style={{flex:1,overflowY:'auto',background:'#f4f7fa'}}><Topbar user={user} title="Inventory Management" subtitle="Manage the shared clinic inventory, stock, and vaccine batches" /><div style={{padding:'22px 24px'}}>{canView ? <SharedInventoryPanel user={user}/> : <p>You do not have permission to view inventory.</p>}</div></div>;
}
