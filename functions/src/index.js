const { getAvailability } = require('./functions/getAvailability');
const { createBooking } = require('./functions/createBooking');
const { onBookingCreated } = require('./functions/onBookingCreated');
const { updateBookingStatus } = require('./functions/updateBookingStatus');
const { submitInquiry } = require('./functions/submitInquiry');

module.exports = {
  getAvailability,
  createBooking,
  onBookingCreated,
  updateBookingStatus,
  submitInquiry,
};
