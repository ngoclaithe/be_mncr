const { body, param } = require('express-validator');

// Validate Cloudinary URL format
const validateCloudinaryUrl = (value) => {
  if (!value) return true; // Allow empty for optional fields
  if (typeof value !== 'string') return false;
  
  const cloudinaryPattern = /^https:\/\/res\.cloudinary\.com\/[^\/]+\/(image|video|raw|auto)\/upload\//;
  return cloudinaryPattern.test(value);
};

// Validate KYC submission creation
const validateKycSubmission = [
  body('documentType')
    .isIn(['passport', 'id_card', 'driving_license'])
    .withMessage('Invalid document type. Must be passport, id_card, or driving_license'),
  
  body('documentNumber')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Document number must be between 3 and 50 characters')
    .matches(/^[A-Za-z0-9\-\s]+$/)
    .withMessage('Document number can only contain letters, numbers, hyphens, and spaces'),
  
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-ZÀ-ỹ\s\-'\.]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, apostrophes, and dots'),
  
  body('dateOfBirth')
    .isISO8601()
    .withMessage('Date of birth must be a valid date in ISO format (YYYY-MM-DD)')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 18) {
        throw new Error('You must be at least 18 years old');
      }
      
      if (age > 120) {
        throw new Error('Please enter a valid date of birth');
      }
      
      return true;
    }),
  
  body('nationality')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nationality must be between 2 and 50 characters')
    .matches(/^[a-zA-ZÀ-ỹ\s]+$/)
    .withMessage('Nationality can only contain letters and spaces'),
  
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address cannot exceed 500 characters'),

  // Cloudinary URL validations
  body('documentFrontUrl')
    .notEmpty()
    .withMessage('Document front image URL is required')
    .custom(validateCloudinaryUrl)
    .withMessage('Invalid Cloudinary URL format for document front image'),
  
  body('documentBackUrl')
    .optional()
    .custom(validateCloudinaryUrl)
    .withMessage('Invalid Cloudinary URL format for document back image'),
  
  body('selfieUrl')
    .notEmpty()
    .withMessage('Selfie image URL is required')
    .custom(validateCloudinaryUrl)
    .withMessage('Invalid Cloudinary URL format for selfie image'),

  // Custom validation to check required documents based on document type
  body('documentType')
    .custom((documentType, { req }) => {
      const requiredDocs = {
        'passport': ['documentFrontUrl', 'selfieUrl'],
        'id_card': ['documentFrontUrl', 'documentBackUrl', 'selfieUrl'],
        'driving_license': ['documentFrontUrl', 'documentBackUrl', 'selfieUrl']
      };

      const required = requiredDocs[documentType] || [];
      
      for (const field of required) {
        if (!req.body[field]) {
          throw new Error(`${field} is required for ${documentType}`);
        }
      }
      
      return true;
    })
];

// Validate KYC submission update
const validateKycUpdate = [
  body('documentType')
    .optional()
    .isIn(['passport', 'id_card', 'driving_license'])
    .withMessage('Invalid document type. Must be passport, id_card, or driving_license'),
  
  body('documentNumber')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Document number must be between 3 and 50 characters')
    .matches(/^[A-Za-z0-9\-\s]+$/)
    .withMessage('Document number can only contain letters, numbers, hyphens, and spaces'),
  
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-ZÀ-ỹ\s\-'\.]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, apostrophes, and dots'),
  
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date in ISO format (YYYY-MM-DD)')
    .custom((value) => {
      if (!value) return true;
      
      const birthDate = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 18) {
        throw new Error('You must be at least 18 years old');
      }
      
      if (age > 120) {
        throw new Error('Please enter a valid date of birth');
      }
      
      return true;
    }),
  
  body('nationality')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nationality must be between 2 and 50 characters')
    .matches(/^[a-zA-ZÀ-ỹ\s]+$/)
    .withMessage('Nationality can only contain letters and spaces'),
  
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address cannot exceed 500 characters'),

  // Cloudinary URL validations for update
  body('documentFrontUrl')
    .optional()
    .custom(validateCloudinaryUrl)
    .withMessage('Invalid Cloudinary URL format for document front image'),
  
  body('documentBackUrl')
    .optional()
    .custom(validateCloudinaryUrl)
    .withMessage('Invalid Cloudinary URL format for document back image'),
  
  body('selfieUrl')
    .optional()
    .custom(validateCloudinaryUrl)
    .withMessage('Invalid Cloudinary URL format for selfie image')
];

// Validate document URL update
const validateDocumentUrl = [
  body('documentType')
    .isIn(['front', 'back', 'selfie'])
    .withMessage('Invalid document type. Must be front, back, or selfie'),
  
  body('documentUrl')
    .notEmpty()
    .withMessage('Document URL is required')
    .custom(validateCloudinaryUrl)
    .withMessage('Invalid Cloudinary URL format')
];

// Validate personal information update
const validatePersonalInfo = [
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-ZÀ-ỹ\s\-'\.]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, apostrophes, and dots'),
  
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date in ISO format (YYYY-MM-DD)')
    .custom((value) => {
      if (!value) return true;
      
      const birthDate = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 18) {
        throw new Error('You must be at least 18 years old');
      }
      
      if (age > 120) {
        throw new Error('Please enter a valid date of birth');
      }
      
      return true;
    }),
  
  body('nationality')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nationality must be between 2 and 50 characters')
    .matches(/^[a-zA-ZÀ-ỹ\s]+$/)
    .withMessage('Nationality can only contain letters and spaces'),
  
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address cannot exceed 500 characters')
];

// Validate KYC level parameter
const validateKycLevel = [
  param('level')
    .isIn(['basic', 'intermediate', 'advanced'])
    .withMessage('Invalid verification level. Must be basic, intermediate, or advanced')
];

// Validate document ID parameter
const validateDocumentId = [
  param('documentId')
    .isIn(['front', 'back', 'selfie'])
    .withMessage('Invalid document ID. Must be front, back, or selfie')
];

// Admin validation for KYC review
const validateKycReview = [
  body('status')
    .isIn(['approved', 'rejected'])
    .withMessage('Status must be approved or rejected'),
  
  body('rejectionReason')
    .if(body('status').equals('rejected'))
    .notEmpty()
    .withMessage('Rejection reason is required when rejecting KYC')
    .isLength({ max: 1000 })
    .withMessage('Rejection reason cannot exceed 1000 characters'),
  
  body('reviewNotes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Review notes cannot exceed 1000 characters')
];

// Validate pagination and filtering for admin endpoints
const validateKycAdminQuery = [
  // Add query parameter validation as needed for admin endpoints
];

module.exports = {
  validateKycSubmission,
  validateKycUpdate,
  validateDocumentUrl,
  validatePersonalInfo,
  validateKycLevel,
  validateDocumentId,
  validateKycReview,
  validateKycAdminQuery
};