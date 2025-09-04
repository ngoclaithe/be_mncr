const { body, param } = require('express-validator');

const VALID_MEDIA_TYPES = ['image', 'video'];

const createStoryValidator = [
  body('content')
    .optional()
    .isString().withMessage('Content must be a string.')
    .isLength({ max: 500 }).withMessage('Content cannot be more than 500 characters.'),
  body('mediaType')
    .trim()
    .notEmpty().withMessage('Media type is required.')
    .isIn(VALID_MEDIA_TYPES)
    .withMessage(`Invalid media type. Must be one of: ${VALID_MEDIA_TYPES.join(', ')}`)
];

const storyIdValidator = [
  param('storyId').isUUID(4).withMessage('Story ID must be a valid UUID.')
];

module.exports = {
  createStoryValidator,
  storyIdValidator
};