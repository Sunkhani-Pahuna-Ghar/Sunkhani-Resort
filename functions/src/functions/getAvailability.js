const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { db } = require('../admin');

// Returns booked date ranges for a room type, so the frontend calendar can gray out
// unavailable dates. Only confirmed bookings block dates -- pending requests don't,
// since they haven't been approved yet.
exports.getAvailability = onCall(async (request) => {
  const { roomTypeId } = request.data || {};

  if (!roomTypeId || typeof roomTypeId !== 'string') {
    throw new HttpsError('invalid-argument', 'roomTypeId is required.');
  }

  const snapshot = await db
    .collection('bookings')
    .where('roomTypeId', '==', roomTypeId)
    .where('status', '==', 'confirmed')
    .get();

  const bookedRanges = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      checkIn: data.checkIn.toDate().toISOString().slice(0, 10),
      checkOut: data.checkOut.toDate().toISOString().slice(0, 10),
    };
  });

  return { roomTypeId, bookedRanges };
});
