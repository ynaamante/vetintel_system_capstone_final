import { useState } from 'react';
import FilterSelect from './FilterSelect';
import StatusIndicator from './StatusIndicator';
import { formatDateText } from '../utils/dateFormatting';

export default function RoleRequestsSection({ requests }) {
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [days, setDays] = useState('');
  const [page, setPage] = useState(1);
  const roles = [...new Set(requests.map(request => request.requested_role).filter(Boolean))].sort();
  const statuses = [...new Set(['pending', 'approved', 'rejected', ...requests.map(request => String(request.status || '').toLowerCase()).filter(Boolean)])];
  const filtered = requests.filter(request => {
    if (status && String(request.status).toLowerCase() !== status) return false;
    if (role && request.requested_role !== role) return false;
    if (days) {
      const cutoff = new Date();
      cutoff.setHours(0, 0, 0, 0);
      cutoff.setDate(cutoff.getDate() - Number(days) + 1);
      const date = new Date(request.created_at);
      if (!Number.isFinite(date.getTime()) || date < cutoff) return false;
    }
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * 10;
  const visibleRequests = filtered.slice(start, start + 10);
  const adminNote = request => request.admin_note || request.review_notes || (String(request.status).toLowerCase() === 'approved' ? 'Approved by Super Admin' : String(request.status).toLowerCase() === 'rejected' ? 'Rejected by Super Admin' : 'Awaiting Super Admin review');
  return <section className="role-requests-section" aria-labelledby="role-requests-title">
    <header className="role-requests-heading"><div><h2 id="role-requests-title">Role Requests</h2><p>Requests submitted to VetIntel Super Admin for new role types.</p></div>
      <div className="role-request-filters">
        <FilterSelect label="Status" value={status} onChange={value=>{setStatus(value);setPage(1);}} options={[{value:'',label:'All Statuses'},...statuses.map(value=>({value,label:value.charAt(0).toUpperCase()+value.slice(1)}))]} />
        <FilterSelect label="Requested Role" value={role} onChange={value=>{setRole(value);setPage(1);}} options={[{value:'',label:'All Requested Roles'},...roles.map(value=>({value,label:value}))]} />
        <FilterSelect label="Date Range" value={days} onChange={value=>{setDays(value);setPage(1);}} options={[{value:'',label:'All Dates'}, {value:'7',label:'Last 7 Days'}, {value:'30',label:'Last 30 Days'}, {value:'90',label:'Last 90 Days'}]} />
      </div>
    </header>
    <div className="role-request-list"><header><h3>Request List</h3><span>Total Requests: {filtered.length}{filtered.length!==requests.length?` of ${requests.length}`:''}</span></header>
      <div className="roles-table-wrap"><table className="roles-table role-request-table"><colgroup><col style={{width:'15%'}}/><col style={{width:'30%'}}/><col style={{width:'11%'}}/><col style={{width:'14%'}}/><col style={{width:'12%'}}/><col style={{width:'18%'}}/></colgroup><thead><tr>{['Requested Role','Reason','Staff Needed','Date Requested','Status','Admin Note'].map(label=><th key={label}>{label}</th>)}</tr></thead>
        <tbody>{visibleRequests.map(request=><tr key={request.id}><td><strong>{request.requested_role}</strong></td><td>{request.reason||'—'}</td><td>{request.requested_users??1}</td><td>{request.created_at?formatDateText(request.created_at):'—'}</td><td><StatusIndicator status={request.status}/></td><td><em>{adminNote(request)}</em></td></tr>)}{!filtered.length&&<tr><td colSpan={6} className="roles-table-empty">{requests.length?'No role requests match these filters.':'No role requests have been submitted yet.'}</td></tr>}</tbody>
      </table></div>
      <nav className="role-request-pagination" aria-label="Role request pages"><span>Showing {filtered.length ? start + 1 : 0}–{Math.min(start + 10, filtered.length)} of {filtered.length} requests</span><div><button type="button" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Previous</button><span aria-live="polite">Page {currentPage} of {pageCount}</span><button type="button" disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)}>Next</button></div></nav>
    </div>
  </section>;
}
