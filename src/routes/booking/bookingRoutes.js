const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/auth');
const {
  createBookingValidation,
  acceptBookingValidation,
  rejectBookingValidation,
  cancelBookingValidation,
  getBookingsValidation
} = require('../../middleware/validation/bookingValidation');

const {
  createBooking,
  acceptBooking,
  rejectBooking,
  completeBooking,
  cancelBooking,
  getUserBookings,
  getCreatorBookings
} = require('../../controllers/booking/bookingController');

// Routes cho user
router.post('/', protect, createBookingValidation, createBooking);
router.get('/user', protect, getBookingsValidation, getUserBookings);
router.put('/:bookingId/cancel', protect, cancelBookingValidation, cancelBooking);

// Routes cho creator
router.get('/creator', protect, getBookingsValidation, getCreatorBookings);
router.put('/:bookingId/accept', protect, acceptBookingValidation, acceptBooking);
router.put('/:bookingId/reject', protect, rejectBookingValidation, rejectBooking);
router.put('/:bookingId/complete', protect, completeBooking);

module.exports = router;