// validation/creatorValidation.js
const { body, param, query } = require('express-validator');

// Creator registration validation
const creatorRegistrationValidation = [
    body('stageName')
        .isLength({ min: 2, max: 50 })
        .withMessage('Stage name phải từ 2-50 ký tự')
        .trim(),
    body('bio')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Bio không được vượt quá 1000 ký tự'),
    body('hourlyRate')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Giá theo giờ phải là số dương'),
    body('minBookingDuration')
        .optional()
        .isInt({ min: 15, max: 480 })
        .withMessage('Thời gian booking tối thiểu phải từ 15-480 phút'),
    body('bookingPrice')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Giá booking phải là số dương'),
    body('subscriptionPrice')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Giá subscription phải là số dương'),
    body('height')
        .optional()
        .isInt({ min: 100, max: 250 })
        .withMessage('Chiều cao phải từ 100-250 cm'),
    body('weight')
        .optional()
        .isInt({ min: 30, max: 200 })
        .withMessage('Cân nặng phải từ 30-200 kg')
];
const createAvailabilityValidator = [
  body('startTime')
    .isISO8601().withMessage('Start time must be a valid ISO 8601 date.')
    .toDate(),
  body('endTime')
    .isISO8601().withMessage('End time must be a valid ISO 8601 date.')
    .toDate()
    .custom((endTime, { req }) => {
      if (endTime <= req.body.startTime) {
        throw new Error('End time must be after start time.');
      }
      return true;
    }),
];

const createBookingValidator = [
  body('availabilityId').isUUID(4).withMessage('Availability ID must be a valid UUID.'),
  body('notes').optional().isString().isLength({ max: 1000 }),
];

const idParamValidator = (paramName) => [
  param(paramName).isUUID(4).withMessage(`${paramName} must be a valid UUID.`),
];

const getCreatorsValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),
];

const removeFollowerValidator = [
  param('followerId')
    .notEmpty().withMessage('followerId is required.')
    .isInt({ gt: 0 }).withMessage('followerId must be a positive integer.')
    .custom(async (value) => {
      const follower = await User.findByPk(value);
      if (!follower) {
        throw new Error('Follower does not exist.');
      }
      return true;
    }),
];

module.exports = {
    creatorRegistrationValidation,
    createAvailabilityValidator,
    createBookingValidator,
    idParamValidator,
    getCreatorsValidator,
    removeFollowerValidator,
};