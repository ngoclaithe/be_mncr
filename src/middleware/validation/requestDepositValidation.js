const { body } = require('express-validator');
const { InfoPayment } = require('../../models');

const createRequestDepositValidator = [
  body('amount')
    .notEmpty().withMessage('Amount is required.')
    .isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),

  body('infoPaymentId')
    .notEmpty().withMessage('infoPaymentId is required.')
    .isInt({ gt: 0 }).withMessage('infoPaymentId must be a positive integer.')
    .custom(async (value) => {
      const infoPayment = await InfoPayment.findOne({ where: { id: value, isActive: true } });
      if (!infoPayment) {
        throw new Error('Invalid or inactive payment information ID.');
      }
      return true;
    }),

  body('codePay')
    .notEmpty().withMessage('Payment code is required.')
    .isString().withMessage('Payment code must be a string.')
    .trim()
    .isLength({ min: 1 }).withMessage('Payment code cannot be empty.'),

  body('metadata')
    .optional({ nullable: true })
    .isObject().withMessage('Metadata must be a valid JSON object.'),
];

const updateRequestDepositValidator = [
  body('status')
    .notEmpty().withMessage('Status is required.')
    .isIn(['completed', 'failed']).withMessage('Status must be either "completed" or "failed".'),
  
  body('metadata')
    .optional({ nullable: true })
    .isObject().withMessage('Metadata must be a valid JSON object.'),
];

module.exports = {
  createRequestDepositValidator,
  updateRequestDepositValidator,
};