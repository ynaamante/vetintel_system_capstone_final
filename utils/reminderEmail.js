const htmlEntities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => htmlEntities[character]);

function reminderEmail({ clinicName, address, phone, email, ownerName, petName, service, dueDate }) {
  const clinicEmail = String(email || '').trim();
  const clinicPhone = String(phone || '').trim();
  const phoneDigits = clinicPhone.replace(/[^\d+]/g, '');
  const emailLink = /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(clinicEmail)
    ? `mailto:${encodeURIComponent(clinicEmail).replace('%40', '@')}`
    : '';
  const phoneLink = /^\+?\d{7,15}$/.test(phoneDigits) ? `tel:${phoneDigits}` : '';
  const bookingLink = emailLink
    ? `${emailLink}?subject=${encodeURIComponent(`Appointment request for ${petName}`)}`
    : phoneLink;

  const heading = `A reminder for ${petName}`;
  const greeting = `Hello ${ownerName},`;
  const introduction = `This is a friendly reminder that ${petName} is due for a service.`;
  const instructions = 'Please contact the clinic to confirm or arrange your appointment.';
  const signature = `The ${clinicName} Team`;
  const footer = `You are receiving this email because you are a client of ${clinicName}.`;
  const fields = [['Pet', petName], ['Service', service], ['Due date', dueDate]];
  const text = [
    clinicName,
    `Veterinary Clinic${address ? ` | ${address}` : ''}`,
    '',
    heading,
    '',
    greeting,
    introduction,
    '',
    ...fields.map(([label, value]) => `${label}: ${value}`),
    '',
    instructions,
    ...(bookingLink ? [`Book an appointment: ${bookingLink}`] : []),
    '',
    'Thank you,',
    signature,
    '',
    ...[clinicName, address, clinicPhone, clinicEmail].filter(Boolean),
    '',
    footer,
  ].join('\n');

  const fieldRows = fields.map(([label, value], index) => {
    const last = index === fields.length - 1;
    const border = last ? '' : 'border-bottom:1px solid #b2dad6;';
    return `<tr>
      <th scope="row" width="34%" style="padding:12px 10px 12px 0;text-align:left;font-weight:normal;font-size:14px;color:#547372;${border}">${label}</th>
      <td style="padding:12px 0;font-weight:bold;color:${last ? '#0d7672' : '#1c3737'};${border}">${escapeHtml(value)}</td>
    </tr>`;
  }).join('\n');
  const contactLine = (label, link) => link
    ? `<a href="${escapeHtml(link)}" style="color:#0d7672;text-decoration:none;overflow-wrap:anywhere;">${escapeHtml(label)}</a>`
    : escapeHtml(label);
  const contact = [
    clinicPhone && contactLine(clinicPhone, phoneLink),
    clinicEmail && contactLine(clinicEmail, emailLink),
  ].filter(Boolean).join('<br>');
  const button = bookingLink ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:34px 0 0;">
      <tr><td bgcolor="#117675" style="border-radius:6px;mso-padding-alt:13px 28px;">
        <a href="${escapeHtml(bookingLink)}" style="display:inline-block;border-radius:6px;background-color:#117675;padding:13px 28px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;mso-padding-alt:0;">Book an appointment</a>
      </td></tr>
    </table>` : '';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(heading)}</title>
  <style>
    @media only screen and (max-width: 480px) {
      .reminder-section { padding-left: 20px !important; padding-right: 20px !important; }
      .reminder-contact { display: block !important; text-align: left !important; padding-top: 12px !important; }
      .reminder-clinic { display: block !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#e2f3f1;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#e2f3f1">
    <tr><td align="center" style="padding:32px 12px 44px;font-family:Arial,sans-serif;">
      <!--[if mso]><table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="max-width:600px;border-top:6px solid #117675;border-radius:8px;">
        <tr><td class="reminder-section" style="padding:32px 40px 26px;border-bottom:1px solid #c4e3df;">
          <p style="margin:0 0 5px;font:bold 22px Georgia,serif;color:#0d7672;">${escapeHtml(clinicName)}</p>
          <p style="margin:0;font-size:13px;line-height:1.5;letter-spacing:0.3px;color:#547372;">Veterinary Clinic${address ? ` &nbsp;|&nbsp; ${escapeHtml(address)}` : ''}</p>
        </td></tr>
        <tr><td class="reminder-section" style="padding:36px 40px 40px;font-size:16px;line-height:1.6;color:#42594c;">
          <h1 style="margin:0 0 14px;font:normal 28px/1.25 Georgia,serif;color:#1c3737;">${escapeHtml(heading)}</h1>
          <p style="margin:0 0 3px;">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 34px;">${escapeHtml(introduction)}</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr><td bgcolor="#d3f3f0" style="padding:4px 20px;border-left:4px solid #117675;border-radius:4px;">
              <table aria-label="Reminder details" width="100%" cellspacing="0" cellpadding="0" border="0">
                ${fieldRows}
              </table>
            </td></tr>
          </table>
          <p style="margin:28px 0 0;">${instructions}</p>
          ${button}
          <p style="margin:40px 0 0;">Thank you,<br><strong style="color:#1c3737;">${escapeHtml(signature)}</strong></p>
        </td></tr>
        <tr><td class="reminder-section" bgcolor="#f1f9f8" style="padding:24px 40px;border-top:1px solid #c4e3df;border-radius:0 0 8px 8px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size:13px;line-height:1.6;color:#42594c;">
            <tr><td class="reminder-clinic" valign="top"><strong style="color:#1c3737;">${escapeHtml(clinicName)}</strong>${address ? `<br>${escapeHtml(address)}` : ''}</td>
            ${contact ? `<td class="reminder-contact" align="right" valign="top" style="padding-left:12px;">${contact}</td>` : ''}
            </tr>
          </table>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
      <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#516d6a;">${escapeHtml(footer)}</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { text, html };
}

module.exports = { reminderEmail };
