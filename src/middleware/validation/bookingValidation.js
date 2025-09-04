const { body, param, query, validationResult } = require('express-validator');

const createBookingValidation = [
  body('creatorId')
    .isInt({ min: 1 })
    .withMessage('Creator ID phải là số nguyên dương'),
  
  body('type')
    .isIn(['private_show', 'private_chat', 'cam2cam', 'byshot', 'byhour'])
    .withMessage('Loại booking không hợp lệ'),
  
  body('duration')
    .isInt({ min: 1 })
    .withMessage('Thời gian phải là số nguyên dương (phút)'),
  
  body('scheduledTime')
    .optional()
    .isISO8601()
    .withMessage('Thời gian đặt lịch phải có định dạng ISO8601')
    .custom((value) => {
      const scheduledDate = new Date(value);
      const now = new Date();
      if (scheduledDate <= now) {
        throw new Error('Thời gian đặt lịch phải sau thời điểm hiện tại');
      }
      return true;
    }),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Ghi chú không được vượt quá 500 ký tự'),

  // Validation riêng cho từng loại booking
  body().custom((value, { req }) => {
    const { type, duration } = req.body;
    
    // Kiểm tra duration tối thiểu cho từng loại
    if (type === 'byhour' && duration < 60) {
      throw new Error('Booking theo giờ phải có thời gian tối thiểu 60 phút');
    }
    
    if (['private_show', 'private_chat', 'cam2cam'].includes(type) && duration < 5) {
      throw new Error('Booking dạng này phải có thời gian tối thiểu 5 phút');
    }
    
    if (type === 'byshot' && duration > 60) {
      throw new Error('Booking byshot không được vượt quá 60 phút');
    }
    
    return true;
  })
];

// Validation cho chấp nhận booking
const acceptBookingValidation = [
  param('bookingId')
    .isInt({ min: 1 })
    .withMessage('Booking ID phải là số nguyên dương')
];

// Validation cho từ chối booking
const rejectBookingValidation = [
  param('bookingId')
    .isInt({ min: 1 })
    .withMessage('Booking ID phải là số nguyên dương'),
  
  body('cancellationReason')
    .notEmpty()
    .withMessage('Lý do từ chối không được để trống')
    .isLength({ min: 10, max: 500 })
    .withMessage('Lý do từ chối phải từ 10-500 ký tự')
];

// Validation cho hủy booking
const cancelBookingValidation = [
  param('bookingId')
    .isInt({ min: 1 })
    .withMessage('Booking ID phải là số nguyên dương'),
  
  body('cancellationReason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Lý do hủy không được vượt quá 500 ký tự')
];

// Validation cho lấy danh sách bookings
const getBookingsValidation = [
  query('status')
    .optional()
    .isIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'])
    .withMessage('Trạng thái booking không hợp lệ'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Trang phải là số nguyên dương'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Giới hạn phải từ 1-50')
];

// Validation cho cập nhật trạng thái booking
const updateBookingStatusValidation = [
  param('bookingId')
    .isInt({ min: 1 })
    .withMessage('Booking ID phải là số nguyên dương'),
  
  body('status')
    .isIn(['confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'])
    .withMessage('Trạng thái không hợp lệ')
];

// Validation cho đánh giá booking
const rateBookingValidation = [
  param('bookingId')
    .isInt({ min: 1 })
    .withMessage('Booking ID phải là số nguyên dương'),
  
  body('rating')
    .isFloat({ min: 1, max: 5 })
    .withMessage('Đánh giá phải từ 1-5 sao'),
  
  body('comment')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Bình luận không được vượt quá 1000 ký tự')
];

// Middleware để handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      errors: errors.array()
    });
  }
  next();
};

module.exports = {
  createBookingValidation,
  acceptBookingValidation,
  rejectBookingValidation,
  cancelBookingValidation,
  getBookingsValidation,
  updateBookingStatusValidation,
  rateBookingValidation,
  handleValidationErrors
};