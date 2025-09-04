const { body } = require('express-validator');

const createInfoPaymentValidator = [
  body('bankNumber')
    .trim()
    .notEmpty().withMessage('Bank number is required.')
    .isString().withMessage('Bank number must be a string.'),

  body('accountName')
    .trim()
    .notEmpty().withMessage('Account name is required.')
    .isString().withMessage('Account name must be a string.'),

  body('bankName')
    .trim()
    .notEmpty().withMessage('Bank name is required.')
    .isString().withMessage('Bank name must be a string.'),

  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Email must be a valid email address.'),

  body('phone')
    .optional()
    .trim()
    .isString().withMessage('Phone must be a string.'),

  body('metadata')
    .optional()
    .custom((value) => {
      if (value !== null && value !== undefined) {
        try {
          if (typeof value === 'string') {
            JSON.parse(value);
          }
          else if (typeof value === 'object') {
            JSON.stringify(value);
          }
          return true;
        } catch (error) {
          throw new Error('Metadata must be valid JSON.');
        }
      }
      return true;
    }),

  body('active')
    .optional()
    .isBoolean().withMessage('Active must be a boolean.'),
];

const updateInfoPaymentValidator = [
  body('bankNumber')
    .optional()
    .trim()
    .notEmpty().withMessage('Bank number cannot be empty.')
    .isString().withMessage('Bank number must be a string.'),

  body('accountName')
    .optional()
    .trim()
    .notEmpty().withMessage('Account name cannot be empty.')
    .isString().withMessage('Account name must be a string.'),

  body('bankName')
    .optional()
    .trim()
    .notEmpty().withMessage('Bank name cannot be empty.')
    .isString().withMessage('Bank name must be a string.'),

  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Email must be a valid email address.'),

  body('phone')
    .optional()
    .trim()
    .isString().withMessage('Phone must be a string.'),

  body('metadata')
    .optional()
    .custom((value) => {
      if (value !== null && value !== undefined) {
        try {
          if (typeof value === 'string') {
            JSON.parse(value);
          }
          else if (typeof value === 'object') {
            JSON.stringify(value);
          }
          return true;
        } catch (error) {
          throw new Error('Metadata must be valid JSON.');
        }
      }
      return true;
    }),

  body('active')
    .optional()
    .isBoolean().withMessage('Active must be a boolean.'),
];

module.exports = {
  createInfoPaymentValidator,
  updateInfoPaymentValidator,
};