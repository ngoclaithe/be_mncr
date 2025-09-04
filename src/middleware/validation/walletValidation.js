const { body } = require('express-validator');
const { User } = require('../../models');

const transferValidator = [
  body('recipientId')
    .notEmpty().withMessage('Recipient ID is required.')
    .isInt({ gt: 0 }).withMessage('Recipient ID must be a positive integer.')
    .custom(async (value, { req }) => {
      if (parseInt(value, 10) === req.user.id) {
        throw new Error('You cannot transfer funds to yourself.');
      }
      const recipient = await User.findByPk(value);
      if (!recipient) {
        throw new Error('Recipient user not found.');
      }
      return true;
    }),

  body('amount')
    .notEmpty().withMessage('Amount is required.')
    .isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),

  body('description')
    .optional()
    .isString().withMessage('Description must be a string.')
    .trim()
    .isLength({ max: 255 }).withMessage('Description cannot be more than 255 characters.'),
];

const withdrawalValidator = [
    body('amount')
      .notEmpty().withMessage('Amount is required.')
      .isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),
  
    body('userBankDetailId')
      .notEmpty().withMessage('Bank detail ID is required.')
      .isInt({ gt: 0 }).withMessage('Bank detail ID must be a positive integer.'),
];

module.exports = {
  transferValidator,
  withdrawalValidator,
};