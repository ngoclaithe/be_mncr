const { body, param } = require('express-validator');
const { User } = require('../../models');

const promoteToAdminValidation = [
  param('userId')
    .isInt({ gt: 0 }).withMessage('User ID must be a positive integer.')
    .custom(async (value) => {
      const user = await User.findByPk(value);
      if (user) {
        if (user.role === 'admin') {
          throw new Error('This user is already an admin.');
        }
      } else {
        throw new Error('User not found.');
      }
      return true;
    }),

  body('adminRole')
    .optional()
    .isIn(['superadmin', 'manager', 'moderator', 'support'])
    .withMessage('Invalid admin role.'),

  body('permissions')
    .optional()
    .isObject()
    .withMessage('Permissions must be a valid JSON object.'),

  body('secretKey')
    .optional()
    .isString()
    .withMessage('Secret key must be a string.'),
];

module.exports = {
  promoteToAdminValidation,
};