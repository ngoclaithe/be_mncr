const { body, param, query, validationResult } = require('express-validator');

const validateCreateReview = [
    body('creatorId')
        .isInt({ min: 1 })
        .withMessage('Creator ID must be a positive integer'),
    
    body('bookingId')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Booking ID must be a positive integer'),
    
    body('rating')
        .isInt({ min: 1, max: 5 })
        .withMessage('Rating must be an integer between 1 and 5'),
    
    body('comment')
        .optional()
        .isString()
        .isLength({ max: 1000 })
        .withMessage('Comment must be a string with maximum 1000 characters')
        .trim(),
    
    body('images')
        .optional()
        .isArray({ max: 5 })
        .withMessage('Images must be an array with maximum 5 items'),
    
    body('images.*')
        .optional()
        .isURL()
        .withMessage('Each image must be a valid URL'),
    
    body('isAnonymous')
        .optional()
        .isBoolean()
        .withMessage('isAnonymous must be a boolean'),
    
    body('isPublic')
        .optional()
        .isBoolean()
        .withMessage('isPublic must be a boolean')
];

const validateUpdateReview = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('Review ID must be a positive integer'),
    
    body('rating')
        .optional()
        .isInt({ min: 1, max: 5 })
        .withMessage('Rating must be an integer between 1 and 5'),
    
    body('comment')
        .optional()
        .isString()
        .isLength({ max: 1000 })
        .withMessage('Comment must be a string with maximum 1000 characters')
        .trim(),
    
    body('images')
        .optional()
        .isArray({ max: 5 })
        .withMessage('Images must be an array with maximum 5 items'),
    
    body('images.*')
        .optional()
        .isURL()
        .withMessage('Each image must be a valid URL'),
    
    body('isAnonymous')
        .optional()
        .isBoolean()
        .withMessage('isAnonymous must be a boolean'),
    
    body('isPublic')
        .optional()
        .isBoolean()
        .withMessage('isPublic must be a boolean')
];

const validateGetReviews = [
    param('creatorId')
        .isInt({ min: 1 })
        .withMessage('Creator ID must be a positive integer'),
    
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Limit must be an integer between 1 and 50'),
    
    query('rating')
        .optional()
        .isInt({ min: 1, max: 5 })
        .withMessage('Rating must be an integer between 1 and 5'),
    
    query('sortBy')
        .optional()
        .isIn(['createdAt', 'rating', 'updatedAt'])
        .withMessage('sortBy must be one of: createdAt, rating, updatedAt'),
    
    query('order')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('order must be either asc or desc')
];

const validateReviewResponse = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('Review ID must be a positive integer'),
    
    body('adminResponse')
        .isString()
        .isLength({ min: 1, max: 500 })
        .withMessage('Admin response must be a string between 1 and 500 characters')
        .trim()
];

const validateReviewId = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('Review ID must be a positive integer')
];

// Custom validation middleware to handle validation results
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

module.exports = {
    validateCreateReview: [...validateCreateReview, handleValidationErrors],
    validateUpdateReview: [...validateUpdateReview, handleValidationErrors],
    validateGetReviews: [...validateGetReviews, handleValidationErrors],
    validateReviewResponse: [...validateReviewResponse, handleValidationErrors],
    validateReviewId: [...validateReviewId, handleValidationErrors]
};