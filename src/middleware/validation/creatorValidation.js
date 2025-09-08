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

const updateCreatorValidator = [

  body('firstName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .trim(),

  body('lastName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .trim(),

  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),

  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),

  body('city')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('City must be between 1 and 100 characters')
    .trim(),

  body('country')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Country must be between 1 and 100 characters')
    .trim(),

  body('timezone')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Timezone must be between 1 and 50 characters'),

  body('language')
    .optional()
    .isLength({ min: 2, max: 10 })
    .withMessage('Language code must be between 2 and 10 characters'),

  // Creator fields validation
  body('stageName')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Stage name must be between 1 and 100 characters')
    .trim(),

  body('titleBio')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Title bio must not exceed 200 characters')
    .trim(),

  body('bio')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Bio must not exceed 2000 characters')
    .trim(),

  body('bioUrls')
    .optional()
    .isArray()
    .withMessage('Bio URLs must be an array'),

  body('bioUrls.*')
    .optional()
    .isURL()
    .withMessage('Each bio URL must be valid'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),

  body('tags.*')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),

  body('hourlyRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Hourly rate must be a positive number'),

  body('minBookingDuration')
    .optional()
    .isInt({ min: 15 })
    .withMessage('Minimum booking duration must be at least 15 minutes'),

  body('maxConcurrentBookings')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Max concurrent bookings must be between 1 and 10'),

  body('bookingPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Booking price must be a positive number'),

  body('subscriptionPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Subscription price must be a positive number'),

  body('specialties')
    .optional()
    .isArray()
    .withMessage('Specialties must be an array'),

  body('languages')
    .optional()
    .isArray()
    .withMessage('Languages must be an array'),

  body('bodyType')
    .optional()
    .isIn(['slim', 'athletic', 'average', 'curvy', 'plus-size'])
    .withMessage('Body type must be one of: slim, athletic, average, curvy, plus-size'),

  body('height')
    .optional()
    .isFloat({ min: 100, max: 250 })
    .withMessage('Height must be between 100 and 250 cm'),

  body('weight')
    .optional()
    .isFloat({ min: 30, max: 200 })
    .withMessage('Weight must be between 30 and 200 kg'),

  body('eyeColor')
    .optional()
    .isIn(['brown', 'blue', 'green', 'hazel', 'gray', 'amber', 'other'])
    .withMessage('Eye color must be one of: brown, blue, green, hazel, gray, amber, other'),

  body('hairColor')
    .optional()
    .isIn(['black', 'brown', 'blonde', 'red', 'gray', 'white', 'other'])
    .withMessage('Hair color must be one of: black, brown, blonde, red, gray, white, other'),

  body('service')
    .optional()
    .isArray()
    .withMessage('Services must be an array'),

  body('isTatto')
    .optional()
    .isBoolean()
    .withMessage('Is tattoo must be true or false'),

  body('cosmeticSurgery')
    .optional()
    .isBoolean()
    .withMessage('Cosmetic surgery must be true or false'),

  body('isAvailableForBooking')
    .optional()
    .isBoolean()
    .withMessage('Available for booking must be true or false'),

  // Admin only fields - will be filtered in controller
  body('isVerified')
    .optional()
    .isBoolean()
    .withMessage('Is verified must be true or false'),

  body('isLive')
    .optional()
    .isBoolean()
    .withMessage('Is live must be true or false'),

  body('totalEarnings')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total earnings must be a positive number'),

  body('rating')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Rating must be between 0 and 5'),

  body('totalRatings')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Total ratings must be a positive integer')
];

module.exports = {
    creatorRegistrationValidation,
    createAvailabilityValidator,
    createBookingValidator,
    idParamValidator,
    getCreatorsValidator,
    removeFollowerValidator,
    updateCreatorValidator
};