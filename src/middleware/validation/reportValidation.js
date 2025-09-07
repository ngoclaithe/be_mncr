const { body, param, query } = require('express-validator');

const createReportValidation = [
  body('reportedUserId')
    .isInt({ min: 1 })
    .withMessage('Invalid user ID'),
  body('reason')
    .notEmpty()
    .withMessage('Reason is required')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Reason must be between 10-1000 characters'),
  body('type')
    .isIn(['harassment', 'spam', 'inappropriate_content', 'fake_profile', 'other'])
    .withMessage('Invalid report type'),
  body('evidence')
    .optional()
    .isArray()
    .withMessage('Evidence must be an array')
];

const getReportsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1-100'),
  query('status')
    .optional()
    .isIn(['pending', 'under_review', 'resolved', 'dismissed'])
    .withMessage('Invalid status'),
  query('type')
    .optional()
    .isIn(['harassment', 'spam', 'inappropriate_content', 'fake_profile', 'other'])
    .withMessage('Invalid type'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'status', 'type'])
    .withMessage('Invalid sortBy field'),
  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC')
];

const getMyReportsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1-100')
];

const getReportStatsValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format')
];

const reportIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid report ID')
];

const updateReportStatusValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid report ID'),
  body('status')
    .isIn(['pending', 'under_review', 'resolved', 'dismissed'])
    .withMessage('Invalid status'),
  body('adminNotes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Admin notes must not exceed 1000 characters'),
  body('actionTaken')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Action taken must not exceed 1000 characters')
];

module.exports = {
  createReportValidation,
  getReportsValidation,
  getMyReportsValidation,
  getReportStatsValidation,
  reportIdValidation,
  updateReportStatusValidation
};