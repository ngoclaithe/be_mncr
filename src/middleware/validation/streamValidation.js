const { body, param, query } = require('express-validator');

const createStreamValidator = [
  body('title')
    .trim()
    .notEmpty().withMessage('Stream title is required.')
    .isLength({ min: 5, max: 100 }).withMessage('Title must be between 5 and 100 characters.'),
  body('description')
    .optional()
    .isLength({ max: 1000 }).withMessage('Description cannot be more than 1000 characters.')
];

const streamIdValidator = [
  param('streamId').isUUID(4).withMessage('Stream ID must be a valid UUID.')
];

const streamKeyValidator = [
  param('streamKey')
    .isHexadecimal().withMessage('Stream key must be a valid hexadecimal string.')
    .isLength({ min: 32, max: 32 }).withMessage('Stream key must be 32 characters long.')
];

// Validator cho việc lấy danh sách live streams với phân trang và category
const getLiveStreamsValidator = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100.')
    .toInt(),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer.')
    .toInt(),
  query('category')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category must be between 1 and 50 characters.')
    .matches(/^[a-zA-Z0-9\s-_]+$/)
    .withMessage('Category can only contain letters, numbers, spaces, hyphens and underscores.')
];

module.exports = {
  createStreamValidator,
  streamIdValidator,
  streamKeyValidator,
  getLiveStreamsValidator,
};