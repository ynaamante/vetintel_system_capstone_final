import { usePageState } from '../utils/usePageState.js';
import { apiFetch as fetch } from '../utils/apiFetch.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icons } from '../icons';
import './SharedInboxPage.css';

const QUICK_REPLIES = ["I'll check and get back to you.", 'Your appointment has been confirmed.', 'Please bring your pet in as soon as possible.', 'The doctor will review your case.'];
const initials = name => String(name || '').split(/\s+/).filter(Boolean).slice(0,2).map(word => word[0]).join('').toUpperCase();
function when(value) {
  const date = new Date(value); if (!Number.isFinite(date.getTime())) return '';
  const today = new Date(); const yesterday = new Date(); yesterday.setDate(today.getDate()-1);
  const day = date.toDateString() === today.toDateString() ? 'Today' : date.toDateString() === yesterday.toDateString() ? 'Yesterday' : date.toLocaleDateString(undefined,{month:'short',day:'numeric'});
  return `${day} · ${date.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}`;
}
const Badge = ({ status }) => <span className="si-status"><i className={status === 'Resolved' ? 'resolved' : ''}/>{status || 'Open'}</span>;

export default function SharedInboxPage({ user, onNavigate, initialConversationRequest }) {
  const [conversations,setConversations] = usePageState(user,'pages/SharedInboxPage.jsx:conversations',[]);
  const [staff,setStaff] = useState([]);
  const [selectedId,setSelectedId] = useState(null);
  const [search,setSearch] = useState('');
  const [status,setStatus] = useState('All Status');
  const [tag,setTag] = useState('All Tags');
  const [tab,setTab] = useState('All');
  const [reply,setReply] = useState('');
  const [mode,setMode] = useState('reply');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [mobileOpen,setMobileOpen] = useState(false);
  const [newMessage,setNewMessage] = useState(false);
  const [patients,setPatients] = useState([]);
  const [patientId,setPatientId] = useState('');
  const [loadingPatients,setLoadingPatients] = useState(false);
  const end = useRef(null);
  const loadVersion = useRef(0);
  const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/,'');
  const request = useCallback(async (path='',options={}) => {
    const response = await fetch(api+'/clinic-records/inbox'+path,{cache:'no-store',...options,headers:{Authorization:'Bearer '+user.token,'Content-Type':'application/json'}});
    const body = await response.json(); if(!response.ok)throw new Error(body.error || 'Unable to load conversations.'); return body;
  },[api,user.token]);
  useEffect(()=>{
    let active=true;
    const load=async()=>{const version=++loadVersion.current;try{const data=await request();if(active&&version===loadVersion.current){setConversations(data.conversations);setStaff(data.staff);setError('');}}catch(failure){if(active)setError(failure.message);}};
    void load();const timer=setInterval(load,5000);window.addEventListener('vetintel:appointment-updated',load);
    return()=>{active=false;loadVersion.current++;clearInterval(timer);window.removeEventListener('vetintel:appointment-updated',load);};
  },[request,user.clinic_id,setConversations]);
  const selected=conversations.find(item=>item.id===selectedId)||conversations[0];
  const selectedMessages=selected?.messages || [];
  useEffect(()=>{end.current?.scrollIntoView({block:'nearest'});},[selected?.id,selectedMessages.length]);
  const upsert=thread=>setConversations(items=>[thread,...items.filter(item=>item.id!==thread.id)]);
  const persist=async(id,updates)=>{loadVersion.current++;const thread=await request('/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(updates)});loadVersion.current++;setConversations(items=>items.map(item=>item.id===thread.id?{...item,...thread}:item));return thread;};
  const select=thread=>{setSelectedId(thread.id);setMobileOpen(true);setReply('');if(thread.unread)persist(thread.id,{unread:false}).catch(failure=>setError(failure.message));};
  const create=async(id)=>{if(!id||busy)return;setBusy(true);setError('');try{loadVersion.current++;const thread=await request('',{method:'POST',body:JSON.stringify({pet_id:id})});loadVersion.current++;upsert(thread);setSelectedId(thread.id);setMobileOpen(true);setNewMessage(false);setSearch('');setTab('All');setStatus('All Status');setTag('All Tags');}catch(failure){setError(failure.message);}finally{setBusy(false);}};
  useEffect(()=>{if(initialConversationRequest)void create(initialConversationRequest.pet_id||initialConversationRequest.id);},[initialConversationRequest]);
  const openNew=async()=>{setNewMessage(true);setPatientId('');setLoadingPatients(true);setError('');try{setPatients(await request('/patients'));}catch(failure){setError(failure.message);}finally{setLoadingPatients(false);}};
  const send=async(kind=mode)=>{if(!reply.trim()||!selected||busy)return;setBusy(true);setError('');try{await persist(selected.id,{text:reply.trim(),kind});setReply('');}catch(failure){setError(failure.message);}finally{setBusy(false);}};
  const update=updates=>{if(selected)persist(selected.id,updates).catch(failure=>setError(failure.message));};
  const unread=conversations.filter(item=>item.unread).length;
  const visible=useMemo(()=>conversations.filter(item=>(`${item.name} ${item.pet} ${item.preview}`.toLowerCase().includes(search.trim().toLowerCase())) && (status==='All Status'||item.status===status)&&(tag==='All Tags'||(item.tags||[]).includes(tag))&&(tab==='All'||tab==='Unread'&&item.unread||tab==='Assigned to me'&&item.assignedTo===user.name)),[conversations,search,status,tag,tab,user.name]);

  return <div className={`si-page${mobileOpen?' si-mobile-open':''}`}>
    <header className="si-banner"><div><h1>Shared Inbox</h1><p>Clinic conversations and communication records</p></div><button onClick={openNew}>{Icons.edit}New message</button></header>
    {error&&<div className="si-error" role="alert">{error}</div>}
    <div className="si-workspace">
      <aside className="si-list">
        <div className="si-list-controls"><div className="si-tabs" role="tablist" aria-label="Conversation views">{[['All',conversations.length],['Unread',unread],['Assigned to me',null]].map(([label,count])=><button role="tab" aria-selected={tab===label} key={label} onClick={()=>setTab(label)}>{label}{count!==null?` (${count})`:''}</button>)}</div>
          <label className="si-search">{Icons.search}<input aria-label="Search conversations" placeholder="Search owner, pet or message" value={search} onChange={event=>setSearch(event.target.value)}/></label>
          <div className="si-filters"><select aria-label="Filter by status" value={status} onChange={event=>setStatus(event.target.value)}>{['All Status','Open','In Progress','Resolved'].map(option=><option key={option}>{option}</option>)}</select><select aria-label="Filter by tag" value={tag} onChange={event=>setTag(event.target.value)}>{['All Tags','Medical','Appointment','Billing','Vomiting','Follow up'].map(option=><option key={option}>{option}</option>)}</select></div>
        </div>
        <div className="si-conversations">{visible.map(thread=><button key={thread.id} className={`si-conversation${selected?.id===thread.id?' is-selected':''}${thread.unread?' is-unread':''}`} onClick={()=>select(thread)} aria-current={selected?.id===thread.id?'true':undefined}><span className="si-avatar">{thread.initials||initials(thread.name)}</span><span className="si-summary"><span className="si-summary-top"><strong>{thread.name}</strong><time>{when(thread.time)}</time></span><span>{[thread.pet,thread.breed].filter(Boolean).join(' · ')}</span><span className="si-preview">{thread.preview||'No messages yet'}</span><span className="si-summary-bottom"><Badge status={thread.status}/><span className="si-tag">{thread.tag||'Medical'}</span></span></span></button>)}{!visible.length&&<p className="si-empty">No conversations match these filters.</p>}</div>
      </aside>
      <section className="si-thread" aria-label={selected?`Conversation with ${selected.name}`:'Conversation'}>
        {selected?<><header className="si-thread-header"><button className="si-back" aria-label="Back to conversations" onClick={()=>setMobileOpen(false)}>‹</button><span className="si-avatar">{selected.initials||initials(selected.name)}</span><div className="si-thread-person"><strong>{selected.name}</strong><span>{selected.pet} · {selected.clinicName||'Clinic conversation'}</span><span><Badge status={selected.status}/> <i>|</i> Assigned to: {selected.assignedTo||'Clinic team'}</span></div>{selected.phone&&<a className="si-outline si-call" href={`tel:${selected.phone.replace(/[^\d+]/g,'')}`}>{Icons.phone}Call owner</a>}<details className="si-menu"><summary aria-label="Conversation options">⋮</summary><div><label>Status<select aria-label="Conversation status" value={selected.status} onChange={event=>update({status:event.target.value})}>{['Open','In Progress','Resolved'].map(option=><option key={option}>{option}</option>)}</select></label><button onClick={()=>update({unread:true})}>Mark unread</button></div></details></header>
          <div className="si-messages" aria-live="polite">{selectedMessages.map((message,index)=><article key={`${message.time}-${index}`} className={`si-message ${message.outgoing?'is-outgoing':''} ${message.kind==='internal_note'?'is-note':''}`}><time>{when(message.time)}</time><div className="si-bubble">{message.text}{message.sharedRecord&&<button className="si-record-attachment" onClick={()=>onNavigate?.('patient-records',selected)}>{Icons.file}<span><strong>{message.sharedRecord.title}</strong><small>Shared patient record</small></span></button>}</div><small>{message.kind==='internal_note'?'Internal note · visible to clinic staff':message.outgoing?'Sent via app ✓✓':'Received from owner'}</small></article>)}{!selectedMessages.length&&<p className="si-empty">Start a conversation with this pet owner.</p>}<div ref={end}/></div>
          <footer className="si-composer"><div className="si-composer-top"><div role="tablist" aria-label="Message type"><button role="tab" aria-selected={mode==='reply'} onClick={()=>setMode('reply')}>Reply</button><button role="tab" aria-selected={mode==='internal_note'} onClick={()=>setMode('internal_note')}>Internal note</button></div><details className="si-quick"><summary>{Icons.mail}Quick replies⌄</summary><div>{QUICK_REPLIES.map(text=><button key={text} onClick={event=>{setReply(text);event.currentTarget.closest('details').open=false;}}>{text}</button>)}</div></details></div><textarea aria-label="Message text" placeholder={mode==='internal_note'?'Write a private note for clinic staff...':'Write a message to the pet owner...'} value={reply} maxLength={4000} onChange={event=>setReply(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();void send();}}}/><div className="si-composer-actions"><button className="si-outline" disabled={busy||!reply.trim()} onClick={()=>send('communication_log')}>{Icons.file}Log communication</button><button className="si-primary" disabled={busy||!reply.trim()} onClick={()=>send()}>{Icons.send}{busy?'Saving...':mode==='internal_note'?'Save note':'Send message'}</button></div></footer>
        </>:<div className="si-empty">Select a conversation or start a new message.</div>}
      </section>
      <aside className="si-details">{selected&&<><section className="si-detail-card"><header className="si-patient-heading"><span className="si-avatar">{initials(selected.pet)}</span><div><strong>{selected.pet}</strong><span>Patient details</span></div><span className="si-active">● Active</span></header><div className="si-detail-row">{Icons.user}<div><strong>Owner</strong><span>{selected.name}</span>{selected.phone&&<a href={`tel:${selected.phone}`}>{selected.phone}</a>}</div></div><div className="si-detail-row">{Icons.users}<div><strong>Assigned to</strong><select aria-label="Assign conversation" value={selected.assignedTo||'Clinic team'} onChange={event=>update({assignedTo:event.target.value})}>{!staff.some(person=>person.name===selected.assignedTo)&&<option>{selected.assignedTo||'Clinic team'}</option>}{staff.map(person=><option key={person.id}>{person.name}</option>)}</select></div></div><div className="si-detail-row">{Icons.calendar}<div><strong>Next appointment</strong><span>{selected.nextAppointment&&Number.isFinite(Date.parse(selected.nextAppointment))?when(selected.nextAppointment):'Not scheduled'}</span></div></div><button className="si-outline si-record" onClick={()=>onNavigate?.('patient-records',selected)}>{<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7V5h6l2 2h10v3M3 10h19l-4 10H2z"/></svg>}View patient record</button></section><details className="si-history si-detail-card" open><summary>{Icons.clock}<strong>Communication history</strong><span>⌃</span></summary><div>{(selected.history||[]).map((entry,index)=><article key={`${entry.time}-${index}`}><strong>{entry.type} · <time>{when(entry.time)}</time></strong><p>{entry.text}</p><span className="si-tag">{entry.tag||selected.tag||'Medical'}</span></article>)}{!selected.history?.length&&<p className="si-empty">No communication recorded yet.</p>}</div></details></>}</aside>
    </div>
    {newMessage&&<div className="si-modal-backdrop" onClick={()=>!busy&&setNewMessage(false)}><section role="dialog" aria-modal="true" aria-label="New message" className="si-modal" onClick={event=>event.stopPropagation()}><header><h2>New message</h2><button aria-label="Close new message" onClick={()=>setNewMessage(false)}>×</button></header><p>Choose a patient to contact their owner.</p><select aria-label="Select patient" value={patientId} onChange={event=>setPatientId(event.target.value)}><option value="">{loadingPatients?'Loading patients...':'Select a patient'}</option>{patients.map(patient=><option key={patient.id} value={patient.id}>{patient.pet} · {patient.owner}</option>)}</select>{!loadingPatients&&!patients.length&&<p>No registered patients available.</p>}<button className="si-primary" disabled={!patientId||busy} onClick={()=>create(patientId)}>{busy?'Opening...':'Open conversation'}</button></section></div>}
  </div>;
}
