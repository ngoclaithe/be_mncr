const { param } = require('express-validator');

const userParamIdValidator = (paramName = 'userId') => [
  param(paramName)
    .isUUID(4)
    .withMessage('User ID must be a valid UUID.')
];

module.exports = { userParamIdValidator };
