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

function verificationEmailHtml({ code, purpose = 'verification' }) {
  const isPasswordReset = purpose === 'password_reset';
  const title = isPasswordReset ? 'Your Password Reset Code' : 'Your Verification Code';
  const intro = isPasswordReset
    ? 'Here is your VetIntel password reset code. Please enter this code in the app to choose a new password.'
    : 'Here is your VetIntel verification code. Please enter this code to verify your account.';
  const ignoreMessage = isPasswordReset
    ? 'If you did not request a password reset, you can safely ignore this email.'
    : 'If you did not request this code, you can safely ignore this email.';
  const safeCode = String(code).replace(/[^0-9]/g, '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VetIntel Email Verification</title>
</head>
<body style="margin:0; padding:0; background-color:#edf8f5; font-family:Arial, Helvetica, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#edf8f5; padding:35px 12px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background-color:#ffffff; border:1px solid #b9e2da; border-radius:16px; overflow:hidden;">
      <tr><td style="background-color:#dff3ee; padding:25px 30px; border-bottom:1px solid #b9e2da;">
        <img src="cid:vetintel-logo" alt="VetIntel Logo" width="250" style="display:block; width:250px; max-width:100%; height:auto; border:0;">
      </td></tr>
      <tr><td style="padding:35px 32px 30px;">
        <h1 style="margin:0 0 18px; color:#075b59; font-size:32px; font-weight:700;">Hello!</h1>
        <p style="margin:0 0 22px; color:#102d42; font-size:17px; line-height:1.6;">${intro}</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#e0f3ee; border-radius:16px;">
          <tr><td align="center" style="padding:22px 15px;">
            <p style="margin:0 0 10px; color:#08766e; font-size:18px; font-weight:600;">${title}</p>
            <p style="margin:0; color:#004e4d; font-size:46px; font-weight:700; letter-spacing:10px;">${safeCode}</p>
          </td></tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center" style="padding:22px 5px;">
            <p style="margin:0; color:#102d42; font-size:16px; line-height:1.5;">This code will expire in <strong style="color:#075b59;">10 minutes.</strong></p>
          </td></tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="border-top:1px solid #c6e5de; font-size:0; line-height:0;">&nbsp;</td></tr>
        </table>
        <p style="margin:20px 0 5px; color:#263e4c; font-size:15px; line-height:1.6; text-align:center;">${ignoreMessage}</p>
      </td></tr>
      <tr><td style="background-color:#d9f1eb; padding:22px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="left" valign="middle">
            <p style="margin:0; color:#075b59; font-size:20px; font-weight:700;">VetIntel</p>
            <p style="margin:5px 0 0; color:#164c50; font-size:13px;">The Pet Health Management System</p>
          </td></tr>
          <tr><td style="padding-top:15px;">
            <p style="margin:0; color:#24515a; font-size:13px; font-style:italic; text-align:center;">Together for a healthier, happier pet community.</p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td height="12" style="background-color:#006d68; font-size:0; line-height:0;">&nbsp;</td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function verificationLogoAttachment() {
  return require('fs').readFileSync(require('path').join(__dirname, '../assets/email/vetintel-logo.png'));
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
  const html = verificationEmailHtml({ code });
  const logo = verificationLogoAttachment();

  if (process.env.BREVO_API_KEY) {
    const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SENDER_EMAIL;
    if (!senderEmail) throw new Error('Email verification is unavailable because the sender email is not configured.');
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ sender: { email: senderEmail, name: process.env.BREVO_SENDER_NAME || 'VetIntel' }, to: [{ email }], subject, textContent: text, htmlContent: html, attachment: [{ name: 'vetintel-logo.png', content: logo.toString('base64'), contentId: 'vetintel-logo' }] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('VetIntel could not send the verification email. Check the email service configuration.');
    return;
  }

  const transport = getTransport();
  if (!transport) throw new Error('Email verification is unavailable because SMTP is not configured.');
  await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: email, subject, text, html, attachments: [{ filename: 'vetintel-logo.png', content: logo, cid: 'vetintel-logo' }] });
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
  const html = verificationEmailHtml({ code, purpose });
  const logo = verificationLogoAttachment();
  if (process.env.BREVO_API_KEY) {
    const sender = process.env.BREVO_SENDER_EMAIL || process.env.SENDER_EMAIL;
    if (!sender) return { sent: false, reason: 'Brevo verification sender is not configured.', errorCode: 'email_sender_missing' };
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { email: sender, name: process.env.BREVO_SENDER_NAME || 'VetIntel' },
          to: [{ email }], subject, textContent: text, htmlContent: html, attachment: [{ name: 'vetintel-logo.png', content: logo.toString('base64'), contentId: 'vetintel-logo' }] }),
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
    const result = await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: email, subject, text, html, attachments: [{ filename: 'vetintel-logo.png', content: logo, cid: 'vetintel-logo' }] });
    const sent = (result.accepted || []).some(value => String(value).toLowerCase() === email.toLowerCase());
    return { sent, messageId: result.messageId, ...(!sent && { reason: 'SMTP did not accept the verification email.', errorCode: 'email_provider_rejected' }) };
  } catch { return { sent: false, reason: 'Could not reach the verification email server.', errorCode: 'email_provider_unreachable' }; }
}
const sendPasswordResetCode = data => sendVerificationCode({ ...data, purpose: 'password_reset' });
module.exports = {
  sendOwnerCredentials,
  sendMessageNotification,
  sendPurchaseOrder,
  reminderEmailConfigured,
  sendClinicReminder,
  sendTwoFactorCode,
  sendTwoFactorSms,
  sendVerificationCode,
  sendPasswordResetCode,
};
