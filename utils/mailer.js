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

async function sendTwoFactorCode({ email, code }) {
  const subject = 'Your VetIntel verification code';
  const text = `Your VetIntel verification code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`;

  if (process.env.BREVO_API_KEY) {
    const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SENDER_EMAIL;
    if (!senderEmail) throw new Error('Email verification is unavailable because the sender email is not configured.');
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ sender: { email: senderEmail, name: process.env.BREVO_SENDER_NAME || 'VetIntel' }, to: [{ email }], subject, textContent: text }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('VetIntel could not send the verification email. Check the email service configuration.');
    return;
  }

  const transport = getTransport();
  if (!transport) throw new Error('Email verification is unavailable because SMTP is not configured.');
  await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: email, subject, text });
}

async function sendTwoFactorSms({ phone, code }) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    throw new Error('Phone verification is unavailable because SMS is not configured.');
  }
  const body = new URLSearchParams({ To: phone, From: TWILIO_FROM_NUMBER, Body: `Your VetIntel verification code is ${code}. It expires in 10 minutes.` });
  const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('VetIntel could not send the verification text. Check the SMS service configuration.');
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
async function sendVerificationCode({ email, code, purpose = 'verification' }) {
  const subject = purpose === 'password_reset' ? 'Reset your VetIntel password' : 'Verify your VetIntel email';
  const text = purpose === 'password_reset'
    ? `Your VetIntel password reset code is ${code}.\n\nIt expires in 10 minutes. Enter it in the app to choose a new password.\nDo not share this code. If you did not request a password reset, ignore this email.`
    : `Your VetIntel verification code is ${code}.\n\nIt expires in 10 minutes. Enter it in the app to verify your email.\nDo not share this code. If you did not request an account, ignore this email.`;
  if (process.env.BREVO_API_KEY) {
    const sender = process.env.BREVO_SENDER_EMAIL || process.env.SENDER_EMAIL;
    if (!sender) return { sent: false, reason: 'Brevo verification sender is not configured.', errorCode: 'email_sender_missing' };
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { email: sender, name: process.env.BREVO_SENDER_NAME || 'VetIntel' },
          to: [{ email }], subject, textContent: text }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.messageId) return { sent: true, messageId: result.messageId };
      const blockedIp = /unrecogni[sz]ed IP|unauthori[sz]ed IP/i.test(result.message || '');
      return { sent: false, status: response.status,
        errorCode: blockedIp ? 'email_ip_not_authorized' : response.status === 401 ? 'email_api_key_invalid'
          : response.status === 403 ? 'email_permission_denied' : response.status === 429 ? 'email_rate_limited' : 'email_provider_rejected',
        reason: blockedIp ? 'Brevo blocked this server IP. Authorize it in Brevo Security > Authorized IPs.'
          : response.status === 401 ? 'Brevo rejected the API key.'
          : response.status === 403 ? 'Brevo denied transactional-email access. Check API key permissions and sending activation.'
          : response.status === 429 ? 'Brevo rate limited the request.'
          : 'Brevo did not accept the email. Check sender verification and account sending limits.' };
    } catch { return { sent: false, reason: 'Could not reach Brevo.', errorCode: 'email_provider_unreachable' }; }
  }
  const transport = getTransport();
  if (!transport) return { sent: false, reason: 'Verification email is not configured.', errorCode: 'email_not_configured' };
  try {
    const result = await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: email, subject, text });
    const sent = (result.accepted || []).some(value => String(value).toLowerCase() === email.toLowerCase());
    return { sent, messageId: result.messageId, ...(!sent && { reason: 'SMTP did not accept the verification email.', errorCode: 'email_provider_rejected' }) };
  } catch { return { sent: false, reason: 'Could not reach the verification email server.', errorCode: 'email_provider_unreachable' }; }
}
const sendPasswordResetCode = data => sendVerificationCode({ ...data, purpose: 'password_reset' });
module.exports = { sendOwnerCredentials, sendMessageNotification, sendPurchaseOrder, reminderEmailConfigured, sendClinicReminder, sendVerificationCode, sendPasswordResetCode, sendTwoFactorCode, sendTwoFactorSms };
