const { body, query, param } = require('express-validator');

const createPostValidation = [
  body('content').optional().isString().trim().isLength({ min: 1, max: 5000 })
    .withMessage('Content must be between 1 and 5000 characters'),
  body('mediaType').optional().isIn(['text', 'image', 'video', 'mixed'])
    .withMessage('Media type must be text, image, video, or mixed'),
  body('mediaUrls').optional().isArray()
    .withMessage('Media URLs must be an array'),
  body('mediaUrls.*').optional().isURL()
    .withMessage('Each media URL must be valid'),
  body('thumbnailUrl').optional().isURL()
    .withMessage('Thumbnail URL must be valid'),
  body('isPublic').optional().isBoolean()
    .withMessage('isPublic must be a boolean'),
  body('isPremium').optional().isBoolean()
    .withMessage('isPremium must be a boolean'),
  body('price').optional().isInt({ min: 0 })
    .withMessage('Price must be a positive integer'),
  body('scheduledAt').optional().isISO8601()
    .withMessage('Scheduled date must be in ISO8601 format'),
  body('tags').optional().isArray()
    .withMessage('Tags must be an array'),
  body('tags.*').optional().isString().trim().isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
  body('location').optional().isString().trim().isLength({ min: 1, max: 255 })
    .withMessage('Location must be between 1 and 255 characters'),
  // Custom validation to ensure content or media is provided
  body().custom((value, { req }) => {
    const { content, mediaUrls } = req.body;
    if (!content && (!mediaUrls || mediaUrls.length === 0)) {
      throw new Error('Either content or media URLs must be provided');
    }
    return true;
  })
];

const updatePostValidation = [
  body('content').optional().isString().trim().isLength({ min: 1, max: 5000 })
    .withMessage('Content must be between 1 and 5000 characters'),
  body('mediaType').optional().isIn(['text', 'image', 'video', 'mixed'])
    .withMessage('Media type must be text, image, video, or mixed'),
  body('mediaUrls').optional().isArray()
    .withMessage('Media URLs must be an array'),
  body('mediaUrls.*').optional().isURL()
    .withMessage('Each media URL must be valid'),
  body('thumbnailUrl').optional().isURL()
    .withMessage('Thumbnail URL must be valid'),
  body('isPublic').optional().isBoolean()
    .withMessage('isPublic must be a boolean'),
  body('isPremium').optional().isBoolean()
    .withMessage('isPremium must be a boolean'),
  body('price').optional().isInt({ min: 0 })
    .withMessage('Price must be a positive integer'),
  body('scheduledAt').optional().isISO8601()
    .withMessage('Scheduled date must be in ISO8601 format'),
  body('tags').optional().isArray()
    .withMessage('Tags must be an array'),
  body('tags.*').optional().isString().trim().isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
  body('location').optional().isString().trim().isLength({ min: 1, max: 255 })
    .withMessage('Location must be between 1 and 255 characters'),
  body('status').optional().isIn(['draft', 'published', 'archived', 'deleted'])
    .withMessage('Status must be draft, published, archived, or deleted')
];

const getPostsValidation = [
  query('page').optional().isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('userId').optional().isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  query('creatorId').optional().isInt({ min: 1 })
    .withMessage('Creator ID must be a positive integer'),
  query('mediaType').optional().isIn(['text', 'image', 'video', 'mixed'])
    .withMessage('Media type must be text, image, video, or mixed'),
  query('isPublic').optional().isBoolean()
    .withMessage('isPublic must be a boolean'),
  query('isPremium').optional().isBoolean()
    .withMessage('isPremium must be a boolean'),
  query('status').optional().isIn(['draft', 'published', 'archived', 'deleted'])
    .withMessage('Status must be draft, published, archived, or deleted'),
  query('tags').optional().isString()
    .withMessage('Tags must be a comma-separated string'),
  query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'viewCount', 'likeCount', 'commentCount', 'shareCount'])
    .withMessage('Sort by must be createdAt, updatedAt, viewCount, likeCount, commentCount, or shareCount'),
  query('order').optional().isIn(['ASC', 'DESC'])
    .withMessage('Order must be ASC or DESC')
];

const getFeedValidation = [
  query('page').optional().isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('mediaType').optional().isIn(['text', 'image', 'video', 'mixed'])
    .withMessage('Media type must be text, image, video, or mixed'),
  query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'viewCount', 'likeCount', 'commentCount', 'shareCount'])
    .withMessage('Sort by must be createdAt, updatedAt, viewCount, likeCount, commentCount, or shareCount'),
  query('order').optional().isIn(['ASC', 'DESC'])
    .withMessage('Order must be ASC or DESC')
];

const searchPostsValidation = [
  query('q').notEmpty().isString().trim().isLength({ min: 1, max: 100 })
    .withMessage('Search query is required and must be between 1 and 100 characters'),
  query('page').optional().isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('mediaType').optional().isIn(['text', 'image', 'video', 'mixed'])
    .withMessage('Media type must be text, image, video, or mixed'),
  query('tags').optional().isString()
    .withMessage('Tags must be a comma-separated string')
];

const validatePostId = [
  param('id').isInt({ min: 1 })
    .withMessage('Post ID must be a positive integer')
];

const validateUserId = [
  param('userId').isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
];

const validateTrendingQuery = [
  query('page').optional().isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('timeframe').optional().isIn(['1d', '7d', '30d'])
    .withMessage('Timeframe must be 1d, 7d, or 30d')
];

const validateCreatorId = [
  param('creatorId').isInt({ min: 1 })
    .withMessage('Creator ID must be a positive integer')
];

module.exports = {
  createPostValidation,
  updatePostValidation,
  getPostsValidation,
  getFeedValidation,
  searchPostsValidation,
  validatePostId,
  validateUserId,
  validateCreatorId,
  validateTrendingQuery
};