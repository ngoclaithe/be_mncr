const express = require('express');
const router = express.Router();
const kycController = require('../../controllers/auth/kycController');
const { protect } = require('../../middleware/auth');
const {
  validateKycSubmission,
  validateKycUpdate,
  validateDocumentUrl,
  validatePersonalInfo,
  validateKycLevel,
  validateDocumentId
} = require('../../middleware/validation/kycValidation');

// ==================== PUBLIC KYC ROUTES ====================

// Get KYC status and information
router.get('/status', protect, kycController.getKycStatus);

// Get current KYC submission
router.get('/submission', protect, kycController.getCurrentSubmission);

// Create new KYC submission (với Cloudinary URLs)
router.post('/submission', protect, validateKycSubmission, kycController.createSubmission);

// Update KYC submission (bao gồm cả URLs)
router.patch('/submission', protect, validateKycUpdate, kycController.updateSubmission);

// Submit KYC for review
router.post('/submit', protect, kycController.submitForReview);

// ==================== DOCUMENT MANAGEMENT ====================

// Update individual document URL
router.patch('/documents/url', protect, validateDocumentUrl, kycController.updateDocumentUrl);

// Delete document
router.delete('/documents/:documentId', protect, validateDocumentId, kycController.deleteDocument);

// Get available document types
router.get('/document-types', protect, kycController.getDocumentTypes);

// ==================== PERSONAL INFORMATION ====================

// Update personal information
router.patch('/personal-info', protect, validatePersonalInfo, kycController.updatePersonalInfo);

// ==================== REQUIREMENTS ====================

// Get KYC requirements by level
router.get('/requirements/:level', protect, validateKycLevel, kycController.getRequirements);

module.exports = router;