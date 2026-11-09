const nodemailer = require('nodemailer');

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: String(SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

async function sendOwnerCredentials({ email, ownerName, clinicName, temporaryPassword }) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP is not configured' };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: `Your VetIntel account for ${clinicName}`,
    text: [
      `Hello ${ownerName},`,
      '',
      `Your VetIntel clinic account for ${clinicName} has been approved.`,
      `Email: ${email}`,
      `Temporary password: ${temporaryPassword}`,
      '',
      'Sign in through your clinic portal and change this password immediately.',
      'If you did not request this account, contact VetIntel support.',
    ].join('\n'),
  });

  return { sent: true };
}

async function sendMessageNotification({ email, senderName, subject }) {
  const transport = getTransport();
  if (!transport) return { sent: false, reason: 'SMTP is not configured' };
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: `VetIntel replied: ${subject}`,
    text: `Hello ${senderName},\n\nThe VetIntel team has replied to your message. Please sign in to view the conversation.`,
  });
  return { sent: true };
}

async function sendPurchaseOrder({ email, supplier, purchaseOrderId, requestedBy, expectedDeliveryDate, notes }) {
  const transport = getTransport();
  if (!transport) return { sent: false, reason: 'SMTP is not configured' };
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: `VetIntel purchase order ${purchaseOrderId}`,
    text: [
      `Hello ${supplier},`,
      '',
      `VetIntel has created purchase order ${purchaseOrderId}.`,
      `Requested by: ${requestedBy}`,
      `Expected delivery date: ${expectedDeliveryDate || 'To be confirmed'}`,
      `Notes: ${notes || 'None'}`,
      '',
      'Please review this purchase order and confirm receipt with the clinic.',
    ].join('\n'),
  });
  return { sent: true };
}

function reminderEmailConfigured() {
  if (process.env.BREVO_API_KEY) return Boolean(process.env.BREVO_SENDER_EMAIL || process.env.SENDER_EMAIL);
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}
async function sendClinicReminder({ email, clinicName, message }) {
  if (process.env.BREVO_API_KEY) {
    const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SENDER_EMAIL;
    if (!senderEmail) return { sent: false, reason: 'Brevo sender email is not configured.' };
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY, accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ sender: { email: senderEmail, name: process.env.BREVO_SENDER_NAME || clinicName },
          to: [{ email }], subject: `${clinicName}: pet care reminder`, textContent: message }),
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return { sent: false, reason: response.status === 403
        ? 'Brevo denied access. Check that this API key has permission to send transactional emails and that Brevo permits this server IP.'
        : response.status === 401 ? 'Brevo rejected the API key. Update BREVO_API_KEY in the backend .env.'
        : response.status === 429 ? 'Brevo is rate limiting requests. Please try again later.'
        : 'Brevo did not accept the reminder. Check the verified sender and account sending limits.' };
      return { sent: Boolean(payload.messageId), messageId: payload.messageId || null };
    } catch {
      return { sent: false, reason: 'Could not reach Brevo. Please try again.' };
    }
  }
  const transport = getTransport();
  if (!transport) return { sent: false, reason: 'Clinic email is not configured.' };
  const result = await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email, subject: `${clinicName}: pet care reminder`, text: message });
  const accepted = (result.accepted || []).some(value => String(value).toLowerCase() === email.toLowerCase());
  return { sent: accepted, messageId: result.messageId || null };
}
module.exports = { sendOwnerCredentials, sendMessageNotification, sendPurchaseOrder, reminderEmailConfigured, sendClinicReminder };
