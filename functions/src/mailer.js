const nodemailer = require('nodemailer');

// Reads SMTP settings from environment variables / Firebase secrets (see functions/.env.example).
// Any SMTP provider works here -- Gmail, SendGrid, Mailgun, etc. Using a dedicated transactional
// email service (SendGrid, Mailgun) is more reliable for production than a personal Gmail account.
function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendOwnerNotification({ subject, text, html }) {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail || !process.env.SMTP_HOST) {
    // Not configured yet -- log instead of throwing, so booking creation never fails
    // just because email isn't set up.
    console.warn('Email not configured (missing OWNER_EMAIL or SMTP_HOST) -- skipping notification.', { subject });
    return;
  }

  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: ownerEmail,
    subject,
    text,
    html,
  });
}

module.exports = { sendOwnerNotification };
