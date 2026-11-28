import { createPortal } from 'react-dom';
import ClinicAttachmentImage from './ClinicAttachmentImage';
﻿import { useEffect, useRef, useState } from 'react';
import { apiFetch as fetch } from '../utils/apiFetch';
import { hasAction } from '../utils/permissionUtils';
import { announceRegistrationUpdate, watchRegistrationUpdates } from '../utils/registrationSync';
import { notifySuccess } from '../utils/notifications';
import { Icons } from '../icons';
import './ownerAppointmentRequests.css';
const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const FILTERS = ['All','Needs Review','Approved','Declined','Cancelled','Reschedule'];
const requestStatus = row => row.request_status || 'Needs Review';
const tone = status => ({ 'Needs Review':'pending',Approved:'approved',Declined:'declined',Cancelled:'declined',Reschedule:'reschedule' })[status] || 'pending';
const schedule = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleDateString('en-US',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'}) + ' · ' + date.toLocaleTimeString('en-US',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'});
};
const idLabel = id => 'APT-' + String(id).padStart(3,'0');
function Status({ value }) { return <span className={'oar-status oar-status-' + tone(value)}><i />{value}</span>; }
export default function OwnerAppointmentRequests({ user, onCountChange }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('Newest');
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [species, setSpecies] = useState('All species');
  const [selectedId, setSelectedId] = useState(null);
  const reviewing = useRef(false);
  const dialog = useRef(null);
  const role = String(user?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const isDoctor = ['doctor','assistant_doctor','veterinarian'].includes(role);
  const canReview = hasAction(user.permissions, user.role, 'Manage Patient Intakes');
  const selected = requests.find(row => row.id === selectedId);
  useEffect(() => { onCountChange?.(requests.length); }, [requests.length,onCountChange]);
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
    else if (!selected && dialog.current?.open) dialog.current.close();
  }, [selected]);
  useEffect(() => {
    if (!isDoctor || !user?.token) return;
    let active = true, fetching = false;
    const load = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const response = await fetch(api + '/clinic-records/registration-intakes/appointment-requests', { headers: { Authorization: 'Bearer ' + user.token }, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw Error(result.error || 'Unable to load appointment requests.');
        if (active) { setRequests(result); setError(''); }
      } catch (failure) { if (active) setError(failure.message); }
      finally { fetching = false; if (active) setLoading(false); }
    };
    void load();
    const stop = watchRegistrationUpdates(load);
    return () => { active = false; stop(); };
  }, [user?.token,isDoctor,revision]);
  if (!isDoctor) return null;
  const review = async (id, action) => {
    if (reviewing.current || !canReview) return;
    reviewing.current = true; setBusy(id); setError('');
    try {
      const response = await fetch(api + '/clinic-records/registration-intakes/appointment-requests/' + id + '/review', {
        method: 'PATCH', headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Unable to review this request.');
      setRequests(rows => rows.map(row => row.id === id ? { ...row,request_status:action==='approve'?'Approved':'Declined',status:result.status } : row));
      setSelectedId(null);
      notifySuccess(action === 'approve' ? 'Appointment request approved.' : 'Appointment request declined.');
      announceRegistrationUpdate();
    } catch (failure) { setError(failure.message); }
    finally { reviewing.current = false; setBusy(null); setRevision(value => value + 1); }
  };
  const count = value => value === 'All' ? requests.length : requests.filter(row => requestStatus(row) === value).length;
  const query = search.trim().toLowerCase();
  const shown = requests.filter(row => (filter==='All'||requestStatus(row)===filter) && (species==='All species'||row.species===species) && (!query||[idLabel(row.id),row.pet,row.owner,row.reason,row.notes?.reason_for_visit].join(' ').toLowerCase().includes(query))).sort((a,b) => {
    const difference = new Date(a.created_at).getTime()-new Date(b.created_at).getTime() || Number(a.id)-Number(b.id);
    return sort==='Newest' ? -difference : difference;
  });
  return <section className="oar" aria-label="Pet owner appointment requests">
    <div className="oar-summary">
      {[['Needs Review','New appointment request','pending'],['Approved','Appointments added to schedule','approved'],['Declined','Appointment requests declined','declined']].map(([status,caption,color]) => <button type="button" key={status} className={'oar-stat oar-stat-'+color} aria-pressed={filter===status} onClick={()=>setFilter(status)}><span className="oar-stat-dot"><i /></span><span><strong>{status}</strong><b>{count(status)}</b><small>{caption}</small></span></button>)}
    </div>
    {error && <div role="alert" className="oar-error">{error}<button type="button" onClick={()=>setRevision(value=>value+1)}>Retry</button></div>}
    <div className="oar-controls"><div className="oar-filters" role="group" aria-label="Filter appointment requests">{FILTERS.map(status=><button type="button" key={status} aria-pressed={filter===status} className={filter===status?'is-active':''} onClick={()=>setFilter(status)}>{status} ({count(status)})</button>)}</div><div className="oar-tools"><label><span className="sr-only">Sort appointment requests</span><select value={sort} onChange={event=>setSort(event.target.value)}><option value="Newest">Sort: Newest</option><option value="Oldest">Sort: Oldest</option></select></label><button type="button" className="oar-filter-button" aria-label="Search and filter requests" aria-expanded={showFilters} onClick={()=>setShowFilters(!showFilters)}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 5h18M6 11h12M10 17h4"/></svg></button></div></div>
    {showFilters && <div className="oar-extra-filters"><label>Search requests<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search pet, owner, request ID..." /></label><label>Species<select value={species} onChange={event=>setSpecies(event.target.value)}><option>All species</option>{[...new Set(requests.map(row=>row.species).filter(Boolean))].map(value=><option key={value}>{value}</option>)}</select></label><button type="button" onClick={()=>{setSearch('');setSpecies('All species');setFilter('All');}}>Clear filters</button></div>}
    <div className="oar-table-wrap"><table className="oar-table"><thead><tr>{['Request ID','Pet','Owner','Appointment Type','Requested Schedule','Reason for Visit','Status',''].map((label,index)=><th key={index}>{label||<span className="sr-only">Details</span>}</th>)}</tr></thead><tbody>
      {shown.map(row=><tr key={row.id} onClick={()=>setSelectedId(row.id)}><td>{idLabel(row.id)}</td><td><div className="oar-pet"><span><strong>{row.pet}</strong><small>{row.species}{row.breed&&' · '+row.breed}</small></span></div></td><td><strong>{row.owner}</strong></td><td>{row.reason}</td><td>{schedule(row.start_time)}</td><td className="oar-reason">{row.notes?.reason_for_visit||'Not provided'}</td><td><Status value={requestStatus(row)}/></td><td><button type="button" className="oar-open" aria-label={'View '+idLabel(row.id)+' for '+row.pet} onClick={event=>{event.stopPropagation();setSelectedId(row.id);}}>{Icons.chevronRight || '›'}</button></td></tr>)}
      {!shown.length&&<tr><td colSpan={8} className="oar-empty">{loading?'Loading appointment requests...':'No appointment requests match your filters.'}</td></tr>}
    </tbody></table></div>
    <aside className="oar-about"><span className="oar-info">i</span><div><strong>About appointment requests</strong><p>These are appointment requests submitted by pet owners through the VetIntel app. Review the details and approve or decline the booking.</p></div></aside>
    {createPortal(<dialog ref={dialog} id="oar-appointment-drawer" className="oar-dialog oar-drawer" aria-describedby="oar-detail-description" aria-labelledby="oar-detail-title" onCancel={event=>{if(busy!=null)event.preventDefault();else setSelectedId(null);}} onClose={()=>setSelectedId(null)}>
      {selected&&<div className="oar-drawer-layout">
        <header className="oar-drawer-header"><div><h2 id="oar-detail-title">Appointment Request</h2><p id="oar-detail-description">Review the details below and approve or decline the booking.</p></div><button type="button" disabled={busy!=null} aria-label="Close appointment details" onClick={()=>setSelectedId(null)}><span className="oar-close-label">Close</span></button></header>
        <div className="oar-drawer-body">
          <section className="oar-drawer-pet" aria-label="Pet and owner">
            <ClinicAttachmentImage attachmentId={selected.photo_attachment_id} src={selected.photo_url} user={user} className="oar-drawer-photo" alt={selected.pet}
              fallback={<span className="oar-drawer-photo oar-drawer-photo-placeholder"><svg width="43" height="43" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6"><ellipse cx="8" cy="10" rx="3" ry="4" transform="rotate(-20 8 10)"/><ellipse cx="15" cy="7" rx="3" ry="4"/><ellipse cx="23" cy="10" rx="3" ry="4" transform="rotate(20 23 10)"/><path d="M9 20c2-1 3-6 7-6s5 5 7 6c4 5 0 10-4 7-2-1-4-1-6 0-5 3-8-2-4-7Z"/></svg></span>} />
            <div className="oar-drawer-owner"><h3>{selected.pet}</h3><p className="oar-drawer-breed">{[selected.species,selected.breed].filter(Boolean).join(' \u00b7 ')}</p><p>Owner: {selected.owner}</p><p>{selected.email||'Email not provided'}</p><p>{selected.phone||'Phone not provided'}</p></div>
            <Status value={requestStatus(selected)}/>
          </section>
          <section className="oar-drawer-details"><h3>Appointment Details</h3><dl>
            {[
              ['Appointment Type',selected.reason],
              ['Preferred Date & Time',schedule(selected.start_time).replace(' \u00b7 ', ', ')+' (Asia/Manila)'],
              ['Reason for Visit',selected.notes?.reason_for_visit],
              ['Additional Notes',selected.notes?.additional_notes||'None'],
            ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'Not provided'}</dd></div>)}
          </dl></section>
          {error&&<p role="alert" className="oar-error">{error}</p>}
        </div>
        <footer className="oar-drawer-footer">{requestStatus(selected)==='Needs Review'?<>
          <button type="button" className="oar-decline" disabled={busy!=null||!canReview} onClick={()=>review(selected.id,'reject')}>Decline</button>
          <button type="button" className="oar-approve" disabled={busy!=null||!canReview} onClick={()=>review(selected.id,'approve')}>{busy===selected.id?'Saving...':'Approve Request'}</button>
        </>:<button type="button" onClick={()=>setSelectedId(null)}>Close</button>}</footer>
      </div>}
    </dialog>, document.body)}
  </section>;
}
