const { body } = require('express-validator');

const streamPackageValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Package name is required.')
    .isLength({ max: 100 }).withMessage('Package name cannot exceed 100 characters.'),

  body('price')
    .isFloat({ gt: 0 }).withMessage('Price must be a positive number.'),

  body('duration')
    .isInt({ gt: 0 }).withMessage('Duration must be a positive integer (in days).'),

  body('description')
    .optional()
    .isString().withMessage('Description must be a string.'),

  body('features')
    .optional()
    .isArray().withMessage('Features must be an array of strings.'),

  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean.'),
];

module.exports = {
  streamPackageValidator,
};