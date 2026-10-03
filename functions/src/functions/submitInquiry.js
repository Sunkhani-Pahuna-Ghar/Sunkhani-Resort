const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { Timestamp } = require('firebase-admin/firestore');
const { db } = require('../admin');
const { sendOwnerNotification } = require('../mailer');

exports.submitInquiry = onCall(async (request) => {
  const { name, email, message } = request.data || {};

  if (!name || !email || !message) {
    throw new HttpsError('invalid-argument', 'name, email, and message are all required.');
  }

  const docRef = await db.collection('inquiries').add({
    name,
    email,
    message,
    status: 'new',
    createdAt: Timestamp.now(),
  });

  await sendOwnerNotification({
    subject: `New contact message from ${name}`,
    text: `From: ${name} <${email}>\n\n${message}`,
  });

  return { success: true, inquiryId: docRef.id };
});
