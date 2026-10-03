const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { Timestamp } = require('firebase-admin/firestore');
const { db } = require('../admin');
const { rangesOverlap } = require('../dateUtils');

const VALID_ROOM_TYPES = ['farm-retreat', 'main-house'];

exports.createBooking = onCall(async (request) => {
  const {
    roomTypeId,
    checkIn,
    checkOut,
    guests,
    guestName,
    guestEmail,
    guestPhone,
    notes,
    language,
  } = request.data || {};

  // --- Basic validation ---
  if (!VALID_ROOM_TYPES.includes(roomTypeId)) {
    throw new HttpsError('invalid-argument', 'Unknown roomTypeId.');
  }
  if (!guestName || !guestEmail) {
    throw new HttpsError('invalid-argument', 'guestName and guestEmail are required.');
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
    throw new HttpsError('invalid-argument', 'checkIn and checkOut must be valid dates.');
  }
  if (checkOutDate <= checkInDate) {
    throw new HttpsError('invalid-argument', 'checkOut must be after checkIn.');
  }

  // --- Overlap check against existing confirmed bookings for this room type ---
  const existing = await db
    .collection('bookings')
    .where('roomTypeId', '==', roomTypeId)
    .where('status', '==', 'confirmed')
    .get();

  const conflict = existing.docs.some((doc) => {
    const data = doc.data();
    return rangesOverlap(
      checkInDate,
      checkOutDate,
      data.checkIn.toDate(),
      data.checkOut.toDate(),
    );
  });

  if (conflict) {
    return { success: false, error: 'DATES_UNAVAILABLE' };
  }

  // --- Create the booking (status starts as "pending" -- the owner confirms manually) ---
  const docRef = await db.collection('bookings').add({
    roomTypeId,
    checkIn: Timestamp.fromDate(checkInDate),
    checkOut: Timestamp.fromDate(checkOutDate),
    guests: Number(guests) || 1,
    guestName,
    guestEmail,
    guestPhone: guestPhone || '',
    notes: notes || '',
    status: 'pending',
    language: language === 'ne' ? 'ne' : 'en',
    createdAt: Timestamp.now(),
  });

  // Email notification is sent by the onBookingCreated Firestore trigger,
  // not here, so it fires even if a booking is created some other way later.

  return { success: true, bookingId: docRef.id, status: 'pending' };
});
