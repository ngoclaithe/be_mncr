const { body, param } = require('express-validator');

/**
 * Validation for creating comment
 */
const createCommentValidator = [
  body('content')
    .trim()
    .notEmpty().withMessage('Comment content cannot be empty.')
    .isLength({ min: 1, max: 2000 }).withMessage('Comment must be between 1 and 2000 characters.')
];

/**
 * Validation for creating reply to comment
 */
const createReplyValidator = [
  body('content')
    .trim()
    .notEmpty().withMessage('Reply content cannot be empty.')
    .isLength({ min: 1, max: 2000 }).withMessage('Reply must be between 1 and 2000 characters.'),
  body('parentCommentId')
    .optional({ checkFalsy: true })
    .isUUID(4).withMessage('Parent Comment ID must be a valid UUID.')
];

/**
 * Validation for updating comment
 */
const updateCommentValidator = [
  body('content')
    .trim()
    .notEmpty().withMessage('Comment content cannot be empty.')
    .isLength({ min: 1, max: 2000 }).withMessage('Comment must be between 1 and 2000 characters.')
];

/**
 * Validation for comment ID parameter
 */
const commentIdValidator = [
  param('id').isUUID(4).withMessage('Comment ID must be a valid UUID.')
];

/**
 * Dynamic validation for comment ID parameter with custom param name
 */
const commentParamIdValidator = (paramName = 'commentId') => [
  param(paramName).isUUID(4).withMessage(`${paramName} must be a valid UUID.`)
];

/**
 * Validation for post ID parameter
 */
const postIdValidator = [
  param('postId').isUUID(4).withMessage('Post ID must be a valid UUID.')
];

/**
 * Validation for pagination and filtering comment queries
 */
const commentQueryValidator = [
  param('postId').optional().isUUID(4).withMessage('Post ID must be a valid UUID.'),
  param('commentId').optional().isUUID(4).withMessage('Comment ID must be a valid UUID.')
];

module.exports = {
  createCommentValidator,
  createReplyValidator,
  updateCommentValidator,
  commentIdValidator,
  commentParamIdValidator,
  postIdValidator,
  commentQueryValidator
};