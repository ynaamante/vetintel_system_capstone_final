import { usePageState } from '../utils/usePageState.js';
import { apiFetch as fetch } from '../utils/apiFetch.js';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import Topbar from '../components/Topbar';
import { Icons } from '../icons';
import { canViewFeature } from '../utils/permissionUtils';
import './summaryStats.css';
import './auditTrailTable.css';
import { formatDateTimeText } from '../utils/dateFormatting';

function downloadAuditCsv(logs) {
  const rows = [
    ['Audit ID', 'Timestamp', 'User', 'Role', 'Activity', 'Pet / Patient', 'Module', 'Result', 'Entity', 'IP Address'],
    ...logs.map(log => [log.id, log.timestamp, log.user, log.role, log.description, log.pet?.name, log.module, log.result, log.entity, log.ip]),
  ];
  const csv = rows
    .map(row => row.map(value => `"${String(value ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'vetintel-audit-trail-report.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function downloadAuditPdf(logs) {
  const pdf = new jsPDF({ orientation: 'landscape' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const columns = [
    ['Audit ID', 22], ['Timestamp', 34], ['Staff', 30], ['Activity', 35],
    ['Pet / Patient', 28], ['Module', 28], ['Result', 24], ['Entity', 32], ['IP Address', 28],
  ];
  let y = 16;

  const drawHeader = () => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.setTextColor(23, 32, 51);
    pdf.text('VetIntel Audit Trail Report', margin, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Generated: ${formatDateTimeText(new Date(), 'en-PH')} | ${logs.length} matching records`, margin, y + 6);
    y += 16;
    pdf.setFillColor(241, 245, 249);
    pdf.rect(margin, y - 4, pageWidth - margin * 2, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(51, 65, 85);
    let x = margin;
    columns.forEach(([label, width]) => {
      pdf.text(label, x + 2, y + 1);
      x += width;
    });
    y += 10;
  };

  drawHeader();
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.8);
  logs.forEach(log => {
    const values = [log.id, log.timestamp, log.user, log.description, log.pet?.name || '—', log.module, log.result, log.entity, log.ip];
    const lines = values.map((value, index) => pdf.splitTextToSize(String(value ?? '-'), columns[index][1] - 4));
    const rowHeight = Math.max(...lines.map(line => line.length)) * 3.5 + 4;
    if (y + rowHeight > pageHeight - margin) {
      pdf.addPage();
      y = 16;
      drawHeader();
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.8);
    }
    let x = margin;
    lines.forEach((line, index) => {
      pdf.setTextColor(51, 65, 85);
      pdf.text(line, x + 2, y, { baseline: 'top' });
      x += columns[index][1];
    });
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y + rowHeight - 2, pageWidth - margin, y + rowHeight - 2);
    y += rowHeight;
  });
  pdf.save('vetintel-audit-trail-report.pdf');
}

function auditDescription(row) {
  const candidate=row.description||row.details||'';
  let data=null;
  if(candidate&&typeof candidate==='object')data=candidate;
  const raw=String(candidate||'').trim();
  if(!data&&raw.startsWith('{')) {
    try {
      data=JSON.parse(raw);
    } catch { /* Use the action label for older malformed audit payloads. */ }
  }
  if(data&&typeof data==='object') {
    if(data.permissions&&data.role)return `Updated ${String(data.role).replace(/[_-]+/g,' ')} permissions`;
    if(data.description||data.title)return String(data.description||data.title);
  } else if(raw) return raw;
  const action=String(row.action||'activity').replace(/[_-]+/g,' ').trim().toLowerCase();
  const table=String(row.category||'').toLowerCase();
  if(table.includes('role_permission')||action.includes('configure clinic role'))return 'Updated clinic role permissions';
  const subject=table.includes('diagnos')?'a diagnosis':table.includes('appointment')?'an appointment':table.includes('lab')?'a laboratory report':table.includes('vaccin')?'a vaccination record':table.includes('invoice')||table.includes('payment')?'a billing record':table.includes('inventory')||table.includes('restock')?'an inventory record':table.includes('pet')?'a patient record':table.includes('user')||table.includes('role')?'staff permissions':'a clinic record';
  const verb=action.includes('update')||action.includes('edit')||action.includes('configure')?'Updated':action.includes('create')?'Created':action.includes('upload')?'Uploaded':action.includes('archive')?'Archived':action.includes('delete')?'Deleted':action.includes('cancel')?'Cancelled':action.includes('complete')?'Completed':action.includes('confirm')?'Confirmed':action.includes('generate')?'Generated':action.charAt(0).toUpperCase()+action.slice(1);
  return `${verb} ${subject}`;
}

function auditModule(row) {
  if(row.module)return row.module;
  const key=`${row.category||''} ${row.action||''}`.toLowerCase();
  if(/login|logout|unauthorized|security|password|auth/.test(key))return 'Security';
  if(/appointment|schedule|consultation/.test(key))return 'Appointments';
  if(/lab|test_result/.test(key))return 'Laboratory';
  if(/vaccin/.test(key))return 'Vaccination';
  if(/prescription|medication|treatment_plan/.test(key))return 'Prescription';
  if(/invoice|payment|billing|refund/.test(key))return 'Billing';
  if(/inventory|restock|stock/.test(key))return 'Inventory';
  if(/user|role|staff|permission/.test(key))return 'Staff Management';
  if(/report|export|document|attachment|upload/.test(key))return 'Data Management';
  if(/diagnos|medical|clinic_record|visit|patient/.test(key))return 'Medical Records';
  if(/pet|client|owner/.test(key))return 'Patient Management';
  return 'Other';
}

function safeAuditChanges(payload, fallbackCategory='') {
  const source=Array.isArray(payload.changes)?payload.changes:null;
  const oldData=payload.old_data||{},newData=payload.new_data||{};
  const changes=source||[...new Set([...Object.keys(oldData),...Object.keys(newData)])]
    .filter(field=>field!=='_audit'&&JSON.stringify(oldData[field])!==JSON.stringify(newData[field]))
    .map(field=>({field,previous:oldData[field],updated:newData[field]}));
  const medical=/diagnos|medical|treatment|consultation|laboratory|lab_result|lab_test|vaccin|prescription|inpatient|patient_record/i.test(String(payload.category||fallbackCategory));
  const medicalFields=new Set(['diagnosis','case_classification','clinical_status','record_status','recorded_at','medication','dosage','frequency','duration','status','result','test_name','vaccine_name','vaccine_date','next_due_date']);
  const sensitive=/password|token|secret|authorization|clinical_assessment|medical_history|notes|email|phone/i;
  return changes.filter(change=>{
    const field=String(change.field||'');
    return !sensitive.test(field)&&!['clinic_id','user_id','pet_id','patient_id','client_id','veterinarian_id','recorded_by','permissions','source','device','attempted_path','attempted_method'].includes(field)&&(!medical||medicalFields.has(field));
  }).slice(0,30).map(change=>({
    field:String(change.field),
    previous:change.previous==null||change.previous===''?'-':typeof change.previous==='object'?'[structured value updated]':String(change.previous).slice(0,180),
    updated:change.updated==null||change.updated===''?'-':typeof change.updated==='object'?'[structured value updated]':String(change.updated).slice(0,180),
  }));
}

function DetailDrawer({ log, token, onClose }) {
  const [detail, setDetail] = useState(log);
  const [error, setError] = useState('');
  useEffect(() => {
    const apiUrl=(import.meta.env.VITE_API_URL||'http://localhost:3000/api').replace(/\/+$/,'');
    const controller=new AbortController();
    fetch(`${apiUrl}/audit-trail/${log.rawId}`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal,cache:'no-store'})
      .then(async response=>{const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Unable to load activity details.');setDetail({...log,...payload,id:log.id,description:auditDescription(payload)||log.description,module:auditModule(payload)||log.module,role:payload.role||log.role,ip_address:payload.ip_address||log.ip,changes:safeAuditChanges(payload,log.entity)});})
      .catch(failure=>{if(failure.name!=='AbortError')setError(failure.message);});
    return()=>controller.abort();
  },[log.rawId,token]);
  useEffect(()=>{const close=event=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[onClose]);
  const result=detail.result||'Successful';
  return createPortal(<>
    <button type="button" className="audit-drawer-scrim" aria-label="Close activity details" onClick={onClose}/>
    <aside className="audit-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="audit-drawer-title">
      <header><div><h2 id="audit-drawer-title">Activity Details</h2><p>{detail.id}</p></div><button type="button" aria-label="Close activity details" onClick={onClose}>{Icons.close}</button></header>
      <div className="audit-drawer-content">
        <span className={`audit-result-pill ${result==='Failed'?'is-failed':''}`}><i/>{result}</span>
        <h3>{detail.description}</h3>
        <p className="audit-drawer-date">{formatDateTimeText(detail.timestamp,'en-PH')}</p>
        <section><h4>Staff Information</h4><strong>{detail.user||'System'}</strong><p>{String(detail.role||'Role not recorded').replace(/[_-]+/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase())}</p></section>
        <section><h4>Affected Patient</h4>{detail.pet?<><strong>{detail.pet.name}</strong><p>{[detail.pet.species,detail.pet.id?`Patient ID: ${detail.pet.id}`:null].filter(Boolean).join(' | ')}</p></>:<p>No patient linked to this activity.</p>}</section>
        <section><h4>Change History</h4>{error&&<p role="alert" className="audit-drawer-error">{error}</p>}{!detail.changes&&!error&&<p>Loading changed fields...</p>}{detail.changes?.length?detail.changes.map((change,index)=><div className="audit-change-pair" key={`${change.field}-${index}`}><div><small>Previous Value | {change.field}</small><p>{change.previous}</p></div><div><small>Updated Value</small><p>{change.updated}</p></div></div>):detail.changes&&<p>No field changes recorded.</p>}</section>
        <section><h4>Additional Information</h4><dl><dt>Module</dt><dd>{detail.module||'Other'}</dd><dt>Action Type</dt><dd>{detail.action||'-'}</dd><dt>Result</dt><dd>{result}</dd><dt>Source</dt><dd>{detail.source||'Not recorded'}</dd><dt>Device</dt><dd>{detail.device||'Not recorded'}</dd><dt>IP Address</dt><dd>{detail.ip_address||'Not recorded'}</dd><dt>Timestamp</dt><dd>{formatDateTimeText(detail.timestamp,'en-PH')}</dd><dt>Affected Record</dt><dd>{detail.category||'record'}{detail.record_id?` #${detail.record_id}`:''}</dd></dl></section>
      </div>
    </aside>
  </>,document.body);
}

export default function AuditTrailPage({ user }) {
  const [logs, setLogs] = usePageState(user, "pages/AuditTrailPage.jsx:logs", []);
  const [loadError, setLoadError] = usePageState(user, "pages/AuditTrailPage.jsx:loadError", '');
  const [search, setSearch] = useState('');
  const [actionFilter, setAction] = useState('All Activities');
  const [userFilter, setUser] = useState('All Staff');
  const [statusFilter, setStatus] = useState('All Statuses');
  const [dateFilter, setDate] = useState('Last 7 Days');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [modal, setModal] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!user?.token) return undefined;
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
    const controller = new AbortController();
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        let cursor = null;
        const rows = [];
        do {
          const query = new URLSearchParams({ paged: 'true' });
          if(dateFilter==='Today') {const today=new Date().toLocaleDateString('en-CA');query.set('from',today);query.set('to',today);}
          else if(dateFilter==='Last 7 Days') query.set('days','7');
          else if(dateFilter==='Last 30 Days') query.set('days','30');
          else if(dateFilter==='Custom Range') { if(customFrom)query.set('from',customFrom); if(customTo)query.set('to',customTo); }
          if (cursor) query.set('before_id', cursor);
          const response = await fetch(`${apiUrl}/audit-trail/filter?${query}`, { headers: { Authorization: `Bearer ${user.token}` }, signal: controller.signal, cache: 'no-store' });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || 'Unable to load audit history.');
          if (!Array.isArray(payload.rows)) throw new Error('Unexpected audit history response.');
          rows.push(...payload.rows);
          cursor = payload.next_cursor;
        } while (cursor && active);
        if (!active) return;
        setLoadError('');
        setLogs(rows.map(row => ({
          rawId:row.id,id:`AUD-${String(row.id).padStart(4,'0')}`,timestamp:row.timestamp,
          user:row.user||'System',role:row.role||(String(row.user_id)===String(user.id)?user.role:'')||'',action:String(row.action||'activity').toLowerCase(),
          description:auditDescription(row),
          entity:`${row.category||'record'}${row.record_id?` #${row.record_id}`:''}`,ip:row.ip_address||'Not recorded',
          module:auditModule(row),result:row.result||(/fail|denied|unauthorized/.test(String(row.action||''))?'Failed':'Successful'),pet:row.pet||null,changedFields:row.changed_fields||[],
        })));
      } catch (error) { if (active && error.name !== 'AbortError') setLoadError(error.message); }
      finally { if (active) setLoading(false); }
    };
    load();
    const reload = () => setRefresh(value => value + 1);
    window.addEventListener('focus', reload);
    window.addEventListener('vetintel:appointment-updated', reload);
    return () => { active = false; controller.abort(); window.removeEventListener('focus', reload); window.removeEventListener('vetintel:appointment-updated', reload); };
  }, [user.token, user.clinic_id, dateFilter, customFrom, customTo, refresh]);
  useEffect(() => setPage(1), [search, actionFilter, userFilter, statusFilter, dateFilter, customFrom, customTo]);

  const canView = canViewFeature(user.permissions, user.role, 'Audit Trail');

  if (!canView) {
    return (
      <div style={s.main}>
        <Topbar user={user} title="Audit Trail" subtitle="System-wide activity logs and security monitoring" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', color: '#64748b' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Access Denied</div>
          <div style={{ fontSize: '0.95rem' }}>You don't have permission to view this feature</div>
        </div>
      </div>
    );
  }

  const filtered = logs.filter(l => {
    const searchable=[l.description,l.user,l.pet?.name,l.module,l.id,String(l.rawId)].filter(Boolean).join(' ').toLowerCase();
    const matchSearch = !search || searchable.includes(search.trim().toLowerCase());
    const matchAction = actionFilter === 'All Activities' || l.module === actionFilter;
    const role=String(l.role||'').trim().toLowerCase().replace(/[\s-]+/g,'_');
    const matchUser=userFilter==='All Staff'||(userFilter==='Veterinarians'&&['doctor','veterinarian'].includes(role))||(userFilter==='Assistants'&&role.includes('assistant'))||(userFilter==='Receptionists'&&role==='receptionist');
    const matchStatus=statusFilter==='All Statuses'||l.result===statusFilter;
    const ageDays = (Date.now() - new Date(l.timestamp).getTime()) / 86400000;
    const localDate=new Date(l.timestamp).toLocaleDateString('en-CA');
    const todayDate=new Date().toLocaleDateString('en-CA');
    const matchDate=dateFilter==='Today'?localDate===todayDate:dateFilter==='Last 7 Days'?ageDays>=0&&ageDays<=7:dateFilter==='Last 30 Days'?ageDays>=0&&ageDays<=30:Boolean(customFrom&&customTo&&localDate>=customFrom&&localDate<=customTo);
    return matchSearch&&matchAction&&matchUser&&matchStatus&&matchDate;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pageCount);
  const visibleLogs = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  const users = [...new Set(logs.map(log => log.user).filter(Boolean))];
  const today = new Date().toDateString();
  const criticalActions = logs.filter(log => ['delete', 'archive', 'unverify', 'override', 'cancel'].some(keyword => log.action.includes(keyword))).length;

  return (
    <div style={s.main}>
      <Topbar user={user} title="Audit Trail" subtitle="System-wide activity logs and security monitoring" />
      <div style={s.page}>

        {/* STAT CARDS */}
        <div className="overview-stats-band" style={s.statsGrid}>{[
          { label: 'Active Users', value: String(users.length), note: 'Unique users in recorded activity' },
          { label: 'Total Actions', value: String(logs.length), note: 'Recorded audit events' },
          { label: "Today's Activity", value: String(logs.filter(log => new Date(log.timestamp).toDateString() === today).length), note: 'Actions recorded today' },
          { label: 'Critical Actions', value: String(criticalActions), note: 'Deletes, archives, overrides, and cancellations' },
          ].map((c, i) => (
            <article key={c.label} className="overview-stats-cell" style={i ? s.statDivider : undefined}>
              <div className="overview-stats-label">{c.label}</div>
              <strong className="overview-stats-value">{c.value}</strong>
              <small className="overview-stats-note">{c.note}</small>
            </article>
          ))}
        </div>

        <section className="audit-log-panel">
          <header className="audit-log-heading">
            <div><h2>Activity Log</h2><p>Review system activity and security events.</p></div>
            <span>{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</span>
          </header>
          {loadError && <div role="alert" style={{ color: '#b91c1c', marginBottom: 12 }}>{loadError}</div>}
        <div className="audit-filter-toolbar"><div role="status" aria-live="polite">{loading ? 'Loading audit history...' : `${filtered.length} matching ${filtered.length===1?'record':'records'}`}</div><button type="button" disabled={loading} onClick={() => setRefresh(value => value + 1)}>{loading ? 'Loading...' : 'Refresh'}</button></div><div className="audit-log-filters" style={s.filterBar}>
          <div style={s.searchWrap}><span style={s.searchIcon}>{Icons.search}</span><input style={s.searchInput} placeholder="Search staff, pet, activity or audit ID..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <select style={s.select} aria-label="Activity filter" value={actionFilter} onChange={e => setAction(e.target.value)}>{['All Activities','Patient Management','Medical Records','Appointments','Laboratory','Vaccination','Prescription','Billing','Inventory','Staff Management','Security','Data Management'].map(a => <option key={a}>{a}</option>)}</select>
          <select style={s.select} aria-label="Staff filter" value={userFilter} onChange={e => setUser(e.target.value)}>{['All Staff','Veterinarians','Assistants','Receptionists'].map(u => <option key={u}>{u}</option>)}</select>
          <select style={s.select} aria-label="Status filter" value={statusFilter} onChange={e => setStatus(e.target.value)}>{['All Statuses','Successful','Failed'].map(value => <option key={value}>{value}</option>)}</select>
          <select style={s.select} aria-label="Date filter" value={dateFilter} onChange={e => setDate(e.target.value)}>{['Today','Last 7 Days','Last 30 Days','Custom Range'].map(d => <option key={d}>{d}</option>)}</select>
          {dateFilter==='Custom Range'&&<div className="audit-custom-range"><label>From<input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}/></label><label>To<input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}/></label></div>}
          {dateFilter==='Custom Range'&&(!customFrom||!customTo)&&<small className="audit-range-help">Choose both dates to apply the range.</small>}
          <div style={s.exportWrap}>
          <button type="button" style={s.exportBtn} disabled={!filtered.length} onClick={() => setShowExportMenu(current => !current)}>
            <span style={{ width: 14, height: 14, display: 'flex' }}>{Icons.download}</span>
            Export ({filtered.length})
          </button>
          {showExportMenu && (
            <div style={s.exportMenu}>
              <div style={s.exportMenuLabel}>Export {filtered.length} matching records</div>
              <button type="button" style={s.exportOption} onClick={() => { downloadAuditCsv(filtered); setShowExportMenu(false); }}>
                CSV
              </button>
              <button type="button" style={s.exportOption} onClick={() => { downloadAuditPdf(filtered); setShowExportMenu(false); }}>
                PDF
              </button>
            </div>
          )}
          </div>
        </div>
          <div className="audit-log-table-wrap">
            <table style={s.table}>
              <thead><tr>{['Date & Time','Staff Member','Activity','Pet / Patient','Module','Status',''].map((h,index)=><th key={`${h}-${index}`} style={{...s.th,width:['15%','17%','25%','15%','15%','10%','3%'][index]}}>{h}</th>)}</tr></thead>
              <tbody>
                {visibleLogs.map((log,i)=><tr key={log.id} className="audit-log-row" tabIndex={0} role="button" aria-label={`View details for ${log.description}`} onClick={()=>setModal(log)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setModal(log);}}} style={{background:i%2===0?'#fff':'#fafafa'}}>
                  <td style={{...s.td,whiteSpace:'nowrap'}}>{formatDateTimeText(log.timestamp,'en-PH')}</td>
                  <td style={s.td}><strong>{log.user}</strong><small className="audit-secondary-text">{String(log.role||'Staff role not recorded').replace(/[_-]+/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase())}</small></td>
                  <td style={{...s.td,color:'#263a34'}}><span className="audit-activity-text" title={log.description}>{log.description}</span></td>
                  <td style={s.td}>{log.pet?<><strong>{log.pet.name}</strong><small className="audit-secondary-text">{log.pet.species||'Patient'}{log.pet.id?` | ID ${log.pet.id}`:''}</small></>:'-'}</td>
                  <td style={s.td}>{log.module}</td><td style={s.td}><span className={`audit-result-pill ${log.result==='Failed'?'is-failed':''}`}><i/>{log.result}</span></td><td style={{...s.td,textAlign:'center',fontSize:20,color:'#344a42'}}>{Icons.chevronRight}</td>
                </tr>)}
                {filtered.length===0&&<tr><td colSpan={7} className="audit-empty-cell" style={s.emptyCell}>No logs match your filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <nav className="role-request-pagination" aria-label="Audit log pages"><span>{filtered.length} entries</span><div><button type="button" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Previous</button><span>Page {currentPage} of {pageCount}</span><button type="button" disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)}>Next</button></div></nav></section>

      </div>

      {modal && <DetailDrawer log={modal} token={user.token} onClose={() => setModal(null)} />}
    </div>
  );
}

const s = {
  main: { flex: 1, overflowY: 'auto', background: '#f1f6ef' },
  page: { padding: '24px 22px 34px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 0, marginBottom: 20 },
  statDivider: { borderLeft: '1px solid #c5d8cb' },
  filterBar: { display: 'flex', alignItems: 'center', gap: 9, background: 'transparent', border: 0, borderRadius: 0, padding: 0, marginBottom: 14, flexWrap: 'wrap' },
  searchWrap: { flex: 1, minWidth: 260, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #cfd8e3', borderRadius: 8, padding: '9px 12px' },
  searchIcon: { width: 14, height: 14, display: 'flex', color: '#8aa0bd', flexShrink: 0 },
  searchInput: { border: 'none', background: 'transparent', outline: 'none', fontSize: '.72rem', color: '#334155', width: '100%' },
  select: { minWidth: 145, padding: '9px 11px', border: '1px solid #cfd8e3', borderRadius: 8, fontSize: '.72rem', color: '#334155', background: '#fff', outline: 'none', cursor: 'pointer' },
  exportWrap: { position: 'relative' },
  exportBtn: { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', background: '#fff', color: '#087341', border: '1px solid #087341', borderRadius: 7, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  exportMenu: { position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 20, minWidth: 150, padding: 6, background: '#fff', border: '1px solid #dbe3ee', borderRadius: 8, boxShadow: '0 10px 24px rgba(15, 23, 42, .12)' },
  exportMenuLabel: { padding: '6px 8px 5px', fontSize: '.66rem', color: '#7185a2', fontWeight: 600 },
  exportOption: { display: 'block', width: '100%', padding: '8px', border: 0, borderRadius: 6, background: '#fff', color: '#334155', textAlign: 'left', fontSize: '.72rem', cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 950, tableLayout: 'fixed' },
  th: { textAlign: 'left', height: 40, padding: '0 11px', fontSize: '.72rem', fontWeight: 700, color: '#172b25', background: '#f6fafb', borderBottom: '1px solid #dce5ed', whiteSpace: 'nowrap' },
  td: { height: 52, padding: '8px 11px', fontSize: '.74rem', borderBottom: '1px solid #e1e8ef', verticalAlign: 'middle', color: '#334155', overflowWrap: 'anywhere' },
  emptyCell: { height: 80, padding: 14, textAlign: 'center', color: '#64748b', fontSize: '.84rem', borderBottom: 0 },
};
