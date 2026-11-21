const publicMessages = thread => (Array.isArray(thread.messages) ? thread.messages : []).filter(message => message.visibility !== 'internal' && message.kind !== 'internal_note');
const ownerThread = (thread, clinicName) => {
  const messages = publicMessages(thread);
  const last = messages.at(-1);
  return { id: thread.id, petId: thread.pet_id, petName: thread.pet, clinicName: clinicName || thread.clinicName || 'Veterinary clinic',
    status: thread.status, messages, preview: last?.text || '', time: last?.time || thread.createdAt || thread.time,
    unread: thread.ownerUnread ?? messages.some(message => message.source !== 'Owner') };
};
const makeThread = (row, actor = 'Clinic team') => {
  const time = new Date().toISOString();
  return { id: `pet-${row.id}`, pet_id: row.id, client_id: row.client_id, name: row.name, phone: row.phone || '',
    pet: row.pet, clinicName: row.clinic_name, species: row.species || '', breed: row.breed || '', sex: row.sex || '',
    weight: row.metadata?.weight || '', initials: String(row.name || '').split(/\s+/).filter(Boolean).map(word => word[0]).join('').slice(0, 2),
    assignedTo: actor, staff: actor, time, createdAt: time, tag: 'Medical', tags: ['Medical'], status: 'Open',
    unread: false, ownerUnread: false, preview: '', nextAppointment: null, messages: [], history: [] };
};
module.exports = { publicMessages, ownerThread, makeThread };
