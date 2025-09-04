const { body } = require('express-validator');
const { StreamPackage } = require('../../models');

const subscribeValidator = [
  body('packageId')
    .notEmpty().withMessage('Package ID is required.')
    .isInt({ gt: 0 }).withMessage('Package ID must be a positive integer.')
    .custom(async (value) => {
      const streamPackage = await StreamPackage.findOne({ where: { id: value, isActive: true } });
      if (!streamPackage) {
        throw new Error('Invalid or inactive stream package ID.');
      }
      return true;
    }),
];

module.exports = {
  subscribeValidator,
};