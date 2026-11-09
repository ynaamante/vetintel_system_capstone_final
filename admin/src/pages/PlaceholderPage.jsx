import Topbar from '../components/Topbar';
import { Icons } from '../icons';

export default function PlaceholderPage({ user, title, subtitle }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f1f6ef' }}>
      <Topbar user={user} title={title} subtitle={subtitle} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '65vh', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', border: '1px solid #e8ecf0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: 18, height: 18, display: 'flex', color: '#64748b' }}>{Icons.refresh}</span>
        </div>
        <div style={{ fontSize: '.85rem', color: '#64748b' }}>{title}</div>
        <div style={{ fontSize: '.75rem', color: '#64748b' }}>This module is coming soon</div>
      </div>
    </div>
  );
}