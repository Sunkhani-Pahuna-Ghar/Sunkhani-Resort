const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { sendOwnerNotification } = require('../mailer');

const ROOM_TYPE_LABELS = {
  'farm-retreat': 'Farm Retreat Rooms',
  'main-house': 'Main House Rooms',
};

exports.onBookingCreated = onDocumentCreated('bookings/{bookingId}', async (event) => {
  const booking = event.data.data();
  const roomLabel = ROOM_TYPE_LABELS[booking.roomTypeId] || booking.roomTypeId;
  const checkIn = booking.checkIn.toDate().toDateString();
  const checkOut = booking.checkOut.toDate().toDateString();

  const text = [
    `New booking request from ${booking.guestName}`,
    `Room: ${roomLabel}`,
    `Dates: ${checkIn} to ${checkOut}`,
    `Guests: ${booking.guests}`,
    `Email: ${booking.guestEmail}`,
    `Phone: ${booking.guestPhone || '(not provided)'}`,
    booking.notes ? `Notes: ${booking.notes}` : null,
    '',
    'Open the admin dashboard to confirm or decline this request.',
  ].filter(Boolean).join('\n');

  await sendOwnerNotification({
    subject: `New booking request — ${roomLabel} (${checkIn})`,
    text,
  });
});
