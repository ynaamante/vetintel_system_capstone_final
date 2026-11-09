import { useEffect, useMemo, useRef, useState } from 'react';
import { Icons } from '../icons';

const INITIAL_CONVERSATIONS = [];

const QUICK_REPLIES = [
  "I'll check and get back to you...",
  'Your appointment has been confirmed.',
  'Please bring your pet in as soon as possible.',
  'The doctor will review your case.',
];

const TAG_STYLES = {
  Medical: { background: '#fee2e2', color: '#dc2626' },
  Appointment: { background: '#f3e8ff', color: '#9333ea' },
  Billing: { background: '#d1fae5', color: '#047857' },
  Vomiting: { background: '#fff1db', color: '#b45309' },
  'Follow up': { background: '#e0edff', color: '#2563eb' },
};

function PetAvatar({ className = '' }) {
  return <img className={`shared-inbox-pet-avatar ${className}`} src="/healthy-pets.png" alt="" />;
}

function StatusDot({ status }) {
  const statusClass = status.toLowerCase().replace(/\s+/g, '-');
  return <span className={`shared-inbox-status shared-inbox-status-${statusClass}`}><i />{status}</span>;
}

export default function SharedInboxPage({ user, onNavigate, initialConversationRequest }) {
  const [conversations, setConversations] = useState(INITIAL_CONVERSATIONS);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Status');
  const [tag, setTag] = useState('All Tags');
  const [activeTab, setActiveTab] = useState('All');
  const [reply, setReply] = useState('');
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const replyRef = useRef(null);
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
  const request = async (path = '', options = {}) => {
    const response = await fetch(api + '/clinic-records/inbox' + path, { ...options, headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' } });
    const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to load clinic conversations.'); return body;
  };
  useEffect(() => {
    let active = true;
    const load = () => request().then(data => { if (active) { setConversations(data.conversations); setStaff(data.staff); setError(''); } }).catch(failure => { if (active) setError(failure.message); });
    load(); const timer = window.setInterval(load, 15000);
    window.addEventListener('vetintel:appointment-updated', load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('vetintel:appointment-updated', load); };
  }, [user.token, user.clinic_id]);

  useEffect(() => {
    if (!initialConversationRequest) return;
    let active = true;
    request('', { method: 'POST', body: JSON.stringify({ pet_id: initialConversationRequest.pet_id || initialConversationRequest.id }) }).then(thread => {
      if (!active) return;
      setConversations(items => [thread, ...items.filter(item => item.id !== thread.id)]);
      setSelectedId(thread.id); setMobileThreadOpen(true); setSearch(''); setStatus('All Status'); setTag('All Tags'); setActiveTab('All');
    }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [initialConversationRequest, user.token]);

  const selected = conversations.find((item) => item.id === selectedId) || conversations[0];
  const unreadCount = conversations.filter((item) => item.unread).length;
  const visible = useMemo(() => conversations.filter((item) => {
    const textMatch = `${item.name} ${item.pet} ${item.preview}`.toLowerCase().includes(search.toLowerCase());
    const statusMatch = status === 'All Status' || item.status === status;
    const tagMatch = tag === 'All Tags' || item.tags.includes(tag);
    const tabMatch = activeTab === 'All'
      || (activeTab === 'Unread' && item.unread)
      || (activeTab === 'My Conversations' && item.assignedTo === (user?.name || 'Clinic team'));
    return textMatch && statusMatch && tagMatch && tabMatch;
  }), [conversations, search, status, tag, activeTab, user]);

  const persist = async (id, updates) => {
    const thread = await request('/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(updates) });
    setConversations(items => items.map(item => item.id === thread.id ? thread : item)); return thread;
  };
  const selectConversation = id => { setSelectedId(id); setMobileThreadOpen(true); persist(id, { unread: false }).catch(failure => setError(failure.message)); };
  const sendReply = async () => {
    if (!reply.trim() || !selected || busy) return;
    setBusy(true); setError('');
    try { await persist(selected.id, { text: reply.trim() }); setReply(''); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  };
  const updateSelected = updates => { if (selected) persist(selected.id, updates).catch(failure => setError(failure.message)); };

  const handleReplyKeyDown = (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      sendReply();
    }
  };

  return (
    <div className={`shared-inbox-page${mobileThreadOpen ? ' mobile-thread-open' : ''}`}>
      <aside className="shared-inbox-list-pane">
        <div className="shared-inbox-brand">
          <h1>Shared Inbox</h1>{error && <p role="alert">{error}</p>}
          <p>Shared clinic conversations and recorded messages</p>
        </div>

        <div className="shared-inbox-tabs" role="tablist" aria-label="Conversation views">
          {[
            { label: 'All', count: conversations.length },
            { label: 'Unread', count: unreadCount },
            { label: 'My Conversations' },
          ].map((tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === tab.label}
              key={tab.label}
              className={`shared-inbox-tab${activeTab === tab.label ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab.label)}
            >
              {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
            </button>
          ))}
        </div>

        <label className="shared-inbox-search">
          <span aria-hidden="true">{Icons.search}</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations..." />
        </label>

        <div className="shared-inbox-filters">
          <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option>All Status</option>
            <option>Open</option>
            <option>In Progress</option>
            <option>Resolved</option>
          </select>
          <select aria-label="Filter by tag" value={tag} onChange={(event) => setTag(event.target.value)}>
            <option>All Tags</option>
            <option>Medical</option>
            <option>Appointment</option>
            <option>Billing</option>
            <option>Vomiting</option>
            <option>Follow up</option>
          </select>
        </div>

        <div className="shared-inbox-conversations inbox-scroll">
          {visible.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => selectConversation(item.id)}
              className={`shared-inbox-conversation${selected?.id === item.id ? ' is-selected' : ''}`}
              aria-current={selected?.id === item.id ? 'true' : undefined}
            >
              {<span className="shared-inbox-initial-avatar">{item.initials}</span>}
              <span className="shared-inbox-conversation-body">
                <span className="shared-inbox-conversation-top"><strong>{item.name}</strong><time>{item.time}</time></span>
                <span className="shared-inbox-pet-line">{item.pet} · {item.breed.split(' ')[0]} · {item.age}</span>
                <span className="shared-inbox-preview">{item.preview}</span>
                <span className="shared-inbox-conversation-bottom">
                  <StatusDot status={item.status} />
                  <span className="shared-inbox-tag" style={TAG_STYLES[item.tag]}>{item.tag}</span>
                </span>
              </span>
            </button>
          ))}
          {visible.length === 0 && <div className="shared-inbox-empty">No conversations match these filters.</div>}
        </div>
      </aside>

      {selected && (
        <section className="shared-inbox-thread" aria-label={`Conversation with ${selected.name}`}>
          <header className="shared-inbox-thread-header">
            <button className="shared-inbox-back" type="button" onClick={() => setMobileThreadOpen(false)} aria-label="Back to conversations">‹</button>
            {selected.id === 1 ? <PetAvatar className="is-large" /> : <span className="shared-inbox-initial-avatar is-large">{selected.initials}</span>}
            <div className="shared-inbox-thread-person">
              <strong>{selected.name}</strong>
              <span>{selected.pet} <i>·</i> {selected.breed} <i>·</i> {selected.age}</span>
              <small>Owner&nbsp; {selected.name} &nbsp;·&nbsp; {selected.staff} &nbsp;·&nbsp; Clinic inbox</small>
            </div>
            <div className="shared-inbox-thread-actions">
              <a href={`tel:${selected.phone.replace(/[^\d+]/g, '')}`}><span>{Icons.phone}</span>Call owner</a>
            </div>
          </header>

          <div className="shared-inbox-messages inbox-scroll">
            {selected.messages.map((message, index) => (
              <article key={`${message.time}-${index}`} className={`shared-inbox-message${message.outgoing ? ' is-outgoing' : ''}`}>
                {!message.outgoing && <span className="shared-inbox-message-avatar">{selected.initials}</span>}
                <div className="shared-inbox-message-content">
                  <div className="shared-inbox-message-meta">
                    <strong>{message.outgoing ? (message.author || 'Clinic team') : selected.name}</strong>
                    <time>{message.time}</time>
                  </div>
                  <p>{message.text}</p>
                  <small>{message.outgoing ? 'Recorded by clinic staff' : 'Received message'}</small>
                </div>
              </article>
            ))}
          </div>

          <footer className="shared-inbox-composer">
            <div className="shared-inbox-quick-title"><span>✦</span> Quick replies</div>
            <div className="shared-inbox-quick-replies">
              {QUICK_REPLIES.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => setReply(suggestion)}>{suggestion}</button>
              ))}
            </div>
            <label className="shared-inbox-reply-as">Reply as:
              <select aria-label="Reply as">
                <option>{user?.name || 'Clinic team'}</option>
                <option>Clinic team</option>
              </select>
            </label>
            <div className="shared-inbox-reply-box">
              <textarea
                ref={replyRef}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                onKeyDown={handleReplyKeyDown}
                placeholder="Type a message..."
                aria-label="Type a message"
              />
              <button type="button" disabled={!reply.trim() || busy} onClick={sendReply}><span>{Icons.send}</span>{busy ? "Saving..." : "Record message"}</button>
            </div>
          </footer>
        </section>
      )}

      {selected && (
        <aside className="shared-inbox-details">
          <section className="shared-inbox-detail-card shared-inbox-patient-card">
            <div className="shared-inbox-patient-heading">
              {selected.id === 1 ? <PetAvatar className="is-large" /> : <span className="shared-inbox-initial-avatar is-large">{selected.initials}</span>}
              <div><strong>{selected.pet}</strong><span>{selected.breed} &nbsp;·&nbsp; {selected.age} &nbsp;·&nbsp; {selected.sex}</span><b className="shared-inbox-active-badge">Active</b></div>
            </div>
            <div className="shared-inbox-detail-row">
              <span className="shared-inbox-detail-icon">{Icons.user}</span>
              <div><strong>Owner</strong><span>{selected.name}</span><a href={`tel:${selected.phone.replace(/[^\d+]/g, '')}`}>{selected.phone}</a></div>
            </div>
            <div className="shared-inbox-detail-row">
              <span className="shared-inbox-detail-icon">{Icons.stethoscope}</span>
              <div><strong>Assigned to</strong>
                <select aria-label="Assign conversation" value={selected.assignedTo} onChange={(event) => updateSelected({ assignedTo: event.target.value })}>
                  {staff.map(person => <option key={person.id}>{person.name}</option>)}
                </select>
                </div>
            </div>
            <div className="shared-inbox-stat-row">
              <div><span className="shared-inbox-detail-icon">{Icons.activity}</span><div><small>Status</small><select aria-label="Conversation status" value={selected.status} onChange={(event) => updateSelected({ status: event.target.value })}><option>Open</option><option>In Progress</option><option>Resolved</option></select></div></div>
              <div><span className="shared-inbox-detail-icon">{Icons.activity}</span><div><small>Weight</small><strong>{selected.weight}</strong></div></div>
            </div>
            <div className="shared-inbox-detail-row shared-inbox-appointment-row">
              <span className="shared-inbox-detail-icon">{Icons.calendar}</span>
              <div><strong>Next appointment</strong><span>{selected.nextAppointment}</span></div>
            </div>
            <button type="button" className="shared-inbox-view-record" onClick={() => onNavigate?.('patient-records', selected)}>View patient record</button>
          </section>

          <section className="shared-inbox-detail-card shared-inbox-history-card">
            <h2><span>{Icons.mail}</span>Communication history</h2>
            {selected.history.map((entry, index) => (
              <div className="shared-inbox-history-entry" key={`${entry.time}-${index}`}>
                <span className="shared-inbox-history-icon">{index === 1 ? Icons.phone : index === 2 ? Icons.calendar : Icons.mail}</span>
                <div><strong>{entry.type}</strong><time>{entry.time}</time><p>{entry.text}</p></div>
              </div>
            ))}
          </section>

          <section className="shared-inbox-detail-card shared-inbox-tags-card">
            <h2>Tags</h2>
            <div>{selected.tags.map((item) => <span key={item} className="shared-inbox-tag" style={TAG_STYLES[item]}>{item}</span>)}</div>
          </section>
        </aside>
      )}
    </div>
  );
}
