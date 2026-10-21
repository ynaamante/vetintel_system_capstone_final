import { useEffect, useMemo, useRef, useState } from 'react';
import { Icons } from '../icons';

const INITIAL_CONVERSATIONS = [
  {
    id: 1,
    initials: 'JS',
    name: 'John Smith',
    phone: '+63 917 555 0133',
    pet: 'Max',
    species: 'Dog',
    breed: 'Golden Retriever',
    age: '6 yrs',
    sex: 'Female',
    weight: '27 kg',
    staff: 'Dr. Torres',
    assignedTo: 'Dr. Torres',
    time: '10:32 AM',
    tag: 'Medical',
    tags: ['Medical', 'Vomiting', 'Follow up'],
    status: 'Open',
    unread: true,
    preview: 'He vomited 3 times this morning and is not eating his food. Should I bring him in?',
    nextAppointment: 'Today · 2:00 PM',
    messages: [
      { text: 'Hi, my dog Max has been vomiting since yesterday afternoon. He seems lethargic too.', time: '10:30 AM', source: 'Mobile App' },
      { text: 'He vomited 3 times this morning and is not eating his food. Should I bring him in?', time: '10:32 AM', source: 'Mobile App' },
    ],
    history: [
      { type: 'Mobile App message', time: 'July 22, 10:32 AM', text: 'He vomited 3 times this morning and is not eating his food...' },
      { type: 'Phone call', time: 'July 22, 10:45 AM', text: 'Reached owner — “Discussed bringing Max in today.”' },
      { type: 'Appointment confirmed', time: 'July 21, 3:12 PM', text: 'Appointment at 2:00 PM · Today.' },
    ],
  },
  {
    id: 2, initials: 'SJ', name: 'Sarah Johnson', phone: '+63 917 555 0184', pet: 'Luna',
    species: 'Cat', breed: 'Domestic Shorthair', age: '2 yrs', sex: 'Female', weight: '4.5 kg',
    staff: 'Dr. Torres', assignedTo: 'Dr. Torres', time: 'Yesterday', tag: 'Appointment',
    tags: ['Appointment'], status: 'Open', unread: true,
    preview: 'Please confirm my 2PM appointment tomorrow.',
    nextAppointment: 'Tomorrow · 2:00 PM',
    messages: [{ text: 'Please confirm my 2PM appointment tomorrow.', time: 'Yesterday, 4:18 PM', source: 'Mobile App' }],
    history: [{ type: 'Mobile App message', time: 'Yesterday, 4:18 PM', text: 'Please confirm my 2PM appointment tomorrow.' }],
  },
  {
    id: 3, initials: 'MD', name: 'Mike Davis', phone: '+63 917 555 0172', pet: 'Charlie',
    species: 'Dog', breed: 'Labrador Retriever', age: '4 yrs', sex: 'Male', weight: '31 kg',
    staff: 'Dr. Chen', assignedTo: 'Dr. Chen', time: 'July 21', tag: 'Medical',
    tags: ['Medical', 'Follow up'], status: 'In Progress', unread: false,
    preview: 'Is slight swelling around the incision normal?',
    nextAppointment: 'Not scheduled',
    messages: [{ text: 'Is slight swelling around the incision normal?', time: 'July 21, 1:06 PM', source: 'Mobile App' }],
    history: [{ type: 'Mobile App message', time: 'July 21, 1:06 PM', text: 'Is slight swelling around the incision normal?' }],
  },
  {
    id: 4, initials: 'EW', name: 'Emma Wilson', phone: '+63 917 555 0140', pet: 'Bella',
    species: 'Dog', breed: 'Beagle', age: '6 yrs', sex: 'Female', weight: '12 kg',
    staff: 'Dr. Torres', assignedTo: 'Dr. Torres', time: 'July 20', tag: 'Appointment',
    tags: ['Appointment'], status: 'Resolved', unread: false,
    preview: 'Thank you, we will come on Saturday!',
    nextAppointment: 'Saturday · 9:30 AM',
    messages: [{ text: 'Thank you, we will come on Saturday!', time: 'July 20, 3:40 PM', source: 'Mobile App' }],
    history: [{ type: 'Mobile App message', time: 'July 20, 3:40 PM', text: 'Thank you, we will come on Saturday!' }],
  },
  {
    id: 5, initials: 'DB', name: 'David Brown', phone: '+63 917 555 0192', pet: 'Rocky',
    species: 'Dog', breed: 'Mixed Breed', age: '3 yrs', sex: 'Male', weight: '19 kg',
    staff: 'Dr. Chen', assignedTo: 'Dr. Chen', time: 'July 22', tag: 'Billing',
    tags: ['Billing'], status: 'Open', unread: false,
    preview: 'When will the lab results be ready?',
    nextAppointment: 'Not scheduled',
    messages: [{ text: 'When will the lab results be ready?', time: 'July 22, 11:14 AM', source: 'Mobile App' }],
    history: [{ type: 'Mobile App message', time: 'July 22, 11:14 AM', text: 'When will the lab results be ready?' }],
  },
  {
    id: 6, initials: 'LT', name: 'Lisa Taylor', phone: '+63 917 555 0116', pet: 'Daisy',
    species: 'Dog', breed: 'Shih Tzu', age: '4 yrs', sex: 'Female', weight: '6 kg',
    staff: 'Dr. Smith', assignedTo: 'Dr. Torres', time: 'July 22', tag: 'Medical',
    tags: ['Medical'], status: 'Open', unread: true,
    preview: 'Can you advise about Daisy’s medication?',
    nextAppointment: 'Not scheduled',
    messages: [{ text: 'Can you advise about Daisy’s medication?', time: 'July 22, 9:18 AM', source: 'Mobile App' }],
    history: [{ type: 'Mobile App message', time: 'July 22, 9:18 AM', text: 'Can you advise about Daisy’s medication?' }],
  },
];

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
  const [selectedId, setSelectedId] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Status');
  const [tag, setTag] = useState('All Tags');
  const [activeTab, setActiveTab] = useState('All');
  const [reply, setReply] = useState('');
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const replyRef = useRef(null);

  useEffect(() => {
    if (!initialConversationRequest) return;
    const requestedOwner = initialConversationRequest.name.trim().toLowerCase();
    const existing = conversations.find((item) => item.name.trim().toLowerCase() === requestedOwner);
    const conversationId = existing?.id || `patient-${initialConversationRequest.id}`;
    const newConversation = {
      ...initialConversationRequest,
      id: conversationId,
      initials: initialConversationRequest.name
        .split(/\s+/)
        .map((part) => part[0] || '')
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      time: 'New',
      tag: 'Medical',
      tags: ['Medical'],
      status: 'Open',
      unread: false,
      preview: `Start a conversation with ${initialConversationRequest.name} about ${initialConversationRequest.pet}.`,
      nextAppointment: 'Not scheduled',
      messages: [],
      history: [],
    };
    setConversations((items) => existing
      ? items.map((item) => item.id === existing.id ? { ...item, unread: false } : item)
      : items.some((item) => item.id === conversationId) ? items : [newConversation, ...items]);
    setSearch('');
    setStatus('All Status');
    setTag('All Tags');
    setActiveTab('All');
    setSelectedId(conversationId);
    setMobileThreadOpen(true);
  }, [initialConversationRequest]);

  const selected = conversations.find((item) => item.id === selectedId) || conversations[0];
  const unreadCount = conversations.filter((item) => item.unread).length;
  const visible = useMemo(() => conversations.filter((item) => {
    const textMatch = `${item.name} ${item.pet} ${item.preview}`.toLowerCase().includes(search.toLowerCase());
    const statusMatch = status === 'All Status' || item.status === status;
    const tagMatch = tag === 'All Tags' || item.tags.includes(tag);
    const tabMatch = activeTab === 'All'
      || (activeTab === 'Unread' && item.unread)
      || (activeTab === 'My Conversations' && item.assignedTo === (user?.name || 'Dr. Torres'));
    return textMatch && statusMatch && tagMatch && tabMatch;
  }), [conversations, search, status, tag, activeTab, user]);

  const selectConversation = (id) => {
    setSelectedId(id);
    setMobileThreadOpen(true);
    setConversations((items) => items.map((item) => item.id === id ? { ...item, unread: false } : item));
  };

  const sendReply = () => {
    if (!reply.trim() || !selected) return;
    const sentAt = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date());
    setConversations((items) => items.map((item) => item.id === selected.id
      ? {
        ...item,
        preview: reply.trim(),
        time: sentAt,
        messages: [...item.messages, { text: reply.trim(), time: sentAt, source: 'Clinic', outgoing: true }],
        history: [{ type: 'Message sent', time: `Today, ${sentAt}`, text: reply.trim() }, ...item.history],
      }
      : item));
    setReply('');
  };

  const updateSelected = (updates) => {
    setConversations((items) => items.map((item) => item.id === selected.id ? { ...item, ...updates } : item));
  };

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
          <h1>Shared Inbox</h1>
          <p>Centralized messaging from pet owners via mobile app</p>
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
              {item.id === 1 ? <PetAvatar /> : <span className="shared-inbox-initial-avatar">{item.initials}</span>}
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
              <small>Owner&nbsp; {selected.name} &nbsp;·&nbsp; {selected.staff} &nbsp;·&nbsp; Mobile App</small>
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
                    <strong>{message.outgoing ? (user?.name || 'Dr. Torres') : selected.name}</strong>
                    <time>{message.time}</time>
                  </div>
                  <p>{message.text}</p>
                  <small>{message.outgoing ? 'Sent from clinic' : 'from mobile app'}</small>
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
                <option>{user?.name || 'Dr. Torres'}</option>
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
              <button type="button" disabled={!reply.trim()} onClick={sendReply}><span>{Icons.send}</span>Send</button>
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
                  <option>Dr. Torres</option><option>Dr. Chen</option><option>Dr. Smith</option>
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
