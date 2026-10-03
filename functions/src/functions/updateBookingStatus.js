const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { db } = require('../admin');

const VALID_STATUSES = ['pending', 'confirmed', 'declined'];

// Admin-only: requires the caller to be signed in with Firebase Auth as the owner's account.
// Firestore security rules should also block direct writes to `bookings` from anyone else,
// so this function is the only path to changing a booking's status.
exports.updateBookingStatus = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in as an admin to do this.');
  }

  const { bookingId, status } = request.data || {};

  if (!bookingId || !VALID_STATUSES.includes(status)) {
    throw new HttpsError('invalid-argument', 'bookingId and a valid status are required.');
  }

  const ref = db.collection('bookings').doc(bookingId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new HttpsError('not-found', 'No booking found with that id.');
  }

  await ref.update({ status });

  return { success: true };
});
