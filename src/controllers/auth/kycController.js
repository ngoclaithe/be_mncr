const { KYC, User } = require('../../models');
const { Op } = require('sequelize');
const { validationResult } = require('express-validator');

class KYCController {
  // Get KYC status and information
  async getKycStatus(req, res) {
    try {
      const userId = req.user.id;
      
      const kyc = await KYC.findOne({
        where: { userId },
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }]
      });

      if (!kyc) {
        return res.json({
          success: true,
          data: {
            status: 'not_submitted',
            kycLevel: 'none',
            canUpgrade: true,
            requirements: this.getKycRequirements('basic')
          }
        });
      }

      const kycLevel = this.getKycLevel(kyc.status);
      
      res.json({
        success: true,
        data: {
          status: kyc.status,
          kycLevel,
          canUpgrade: kyc.status === 'approved',
          verifiedAt: kyc.verifiedAt,
          expiryDate: kyc.expiryDate,
          rejectionReason: kyc.rejectionReason,
          requirements: this.getKycRequirements(kycLevel)
        }
      });
    } catch (error) {
      console.error('Get KYC status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get current KYC submission
  async getCurrentSubmission(req, res) {
    try {
      const userId = req.user.id;
      
      const kyc = await KYC.findOne({
        where: { userId },
        include: [{
          model: User,
          as: 'reviewer',
          attributes: ['id', 'username'],
          required: false
        }]
      });

      if (!kyc) {
        return res.status(404).json({
          success: false,
          message: 'No KYC submission found'
        });
      }

      // Mask sensitive data but keep full URLs for documents
      const submissionData = {
        id: kyc.id,
        documentType: kyc.documentType,
        documentNumber: kyc.documentNumber.replace(/(.{2}).*(.{2})/, '$1***$2'),
        fullName: kyc.fullName,
        dateOfBirth: kyc.dateOfBirth,
        nationality: kyc.nationality,
        address: kyc.address,
        status: kyc.status,
        reviewNotes: kyc.reviewNotes,
        rejectionReason: kyc.rejectionReason,
        verifiedAt: kyc.verifiedAt,
        expiryDate: kyc.expiryDate,
        createdAt: kyc.createdAt,
        updatedAt: kyc.updatedAt,
        documentFrontUrl: kyc.documentFrontUrl,
        documentBackUrl: kyc.documentBackUrl,
        selfieUrl: kyc.selfieUrl,
        hasDocumentFront: !!kyc.documentFrontUrl,
        hasDocumentBack: !!kyc.documentBackUrl,
        hasSelfie: !!kyc.selfieUrl,
        reviewer: kyc.reviewer
      };

      res.json({
        success: true,
        data: submissionData
      });
    } catch (error) {
      console.error('Get current submission error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Create KYC submission with Cloudinary URLs
  async createSubmission(req, res) {
    try {
      const errors = validationResult(req);
      console.log("==== Incoming KYC Submission ====");
      console.log("Headers:", req.headers);
      console.log("Body:", req.body);
      console.log("Validation errors:", errors.array());
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      
      // Check if KYC already exists
      const existingKyc = await KYC.findOne({ where: { userId } });
      if (existingKyc) {
        return res.status(409).json({
          success: false,
          message: 'KYC submission already exists. Use update instead.'
        });
      }

      const {
        documentType,
        documentNumber,
        fullName,
        dateOfBirth,
        nationality,
        address,
        documentFrontUrl,
        documentBackUrl,
        selfieUrl
      } = req.body;

      // Validate required URLs based on document type
      const requiredDocs = this.getRequiredDocuments(documentType);
      if (!documentFrontUrl) {
        return res.status(400).json({
          success: false,
          message: 'Document front image URL is required'
        });
      }

      if (!selfieUrl) {
        return res.status(400).json({
          success: false,
          message: 'Selfie image URL is required'
        });
      }

      if (requiredDocs.includes('back') && !documentBackUrl) {
        return res.status(400).json({
          success: false,
          message: 'Document back image URL is required for this document type'
        });
      }

      // Validate Cloudinary URLs
      if (!this.isValidCloudinaryUrl(documentFrontUrl) || 
          !this.isValidCloudinaryUrl(selfieUrl) ||
          (documentBackUrl && !this.isValidCloudinaryUrl(documentBackUrl))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Cloudinary URL format'
        });
      }

      const kycData = {
        userId,
        documentType,
        documentNumber,
        fullName,
        dateOfBirth,
        nationality,
        address,
        status: 'pending',
        documentFrontUrl,
        selfieUrl
      };

      // Add documentBackUrl only if provided
      if (documentBackUrl) {
        kycData.documentBackUrl = documentBackUrl;
      }

      const kyc = await KYC.create(kycData);

      res.status(201).json({
        success: true,
        message: 'KYC submission created successfully',
        data: {
          id: kyc.id,
          status: kyc.status,
          documentFrontUrl: kyc.documentFrontUrl,
          documentBackUrl: kyc.documentBackUrl,
          selfieUrl: kyc.selfieUrl,
          createdAt: kyc.createdAt
        }
      });
    } catch (error) {
      console.error('Create submission error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Update KYC submission
  async updateSubmission(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      
      const kyc = await KYC.findOne({ where: { userId } });
      if (!kyc) {
        return res.status(404).json({
          success: false,
          message: 'KYC submission not found'
        });
      }

      // Only allow updates if status is pending or rejected
      if (!['pending', 'rejected'].includes(kyc.status)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot update KYC submission in current status'
        });
      }

      const updateFields = {};
      const allowedFields = [
        'documentType', 'documentNumber', 'fullName', 
        'dateOfBirth', 'nationality', 'address',
        'documentFrontUrl', 'documentBackUrl', 'selfieUrl'
      ];

      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          // Validate Cloudinary URLs if they are being updated
          if (field.includes('Url') && req.body[field] && !this.isValidCloudinaryUrl(req.body[field])) {
            return res.status(400).json({
              success: false,
              message: `Invalid Cloudinary URL format for ${field}`
            });
          }
          updateFields[field] = req.body[field];
        }
      });

      // Validate required documents if document type is being changed
      if (updateFields.documentType) {
        const requiredDocs = this.getRequiredDocuments(updateFields.documentType);
        const frontUrl = updateFields.documentFrontUrl || kyc.documentFrontUrl;
        const backUrl = updateFields.documentBackUrl || kyc.documentBackUrl;
        const selfieUrl = updateFields.selfieUrl || kyc.selfieUrl;

        if (!frontUrl || !selfieUrl) {
          return res.status(400).json({
            success: false,
            message: 'Document front and selfie URLs are required'
          });
        }

        if (requiredDocs.includes('back') && !backUrl) {
          return res.status(400).json({
            success: false,
            message: 'Document back URL is required for this document type'
          });
        }
      }

      // Reset status to pending if it was rejected
      if (kyc.status === 'rejected') {
        updateFields.status = 'pending';
        updateFields.rejectionReason = null;
        updateFields.reviewNotes = null;
      }

      await kyc.update(updateFields);

      res.json({
        success: true,
        message: 'KYC submission updated successfully',
        data: {
          id: kyc.id,
          status: kyc.status,
          documentFrontUrl: kyc.documentFrontUrl,
          documentBackUrl: kyc.documentBackUrl,
          selfieUrl: kyc.selfieUrl,
          updatedAt: kyc.updatedAt
        }
      });
    } catch (error) {
      console.error('Update submission error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Submit KYC for review
  async submitForReview(req, res) {
    try {
      const userId = req.user.id;
      
      const kyc = await KYC.findOne({ where: { userId } });
      if (!kyc) {
        return res.status(404).json({
          success: false,
          message: 'KYC submission not found'
        });
      }

      // Validate required documents
      const requiredDocs = this.getRequiredDocuments(kyc.documentType);
      if (!kyc.documentFrontUrl || !kyc.selfieUrl) {
        return res.status(400).json({
          success: false,
          message: 'Missing required documents. Please upload all required documents.'
        });
      }

      if (requiredDocs.includes('back') && !kyc.documentBackUrl) {
        return res.status(400).json({
          success: false,
          message: 'Document back image is required for this document type.'
        });
      }

      // Check if already submitted
      if (kyc.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'KYC submission is not in pending status'
        });
      }

      res.json({
        success: true,
        message: 'KYC submission sent for review successfully',
        data: {
          id: kyc.id,
          status: kyc.status,
          submittedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Submit for review error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Update document URL (for individual document updates)
  async updateDocumentUrl(req, res) {
    try {
      const userId = req.user.id;
      const { documentType, documentUrl } = req.body;
      
      if (!documentUrl) {
        return res.status(400).json({
          success: false,
          message: 'Document URL is required'
        });
      }

      // Validate Cloudinary URL
      if (!this.isValidCloudinaryUrl(documentUrl)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Cloudinary URL format'
        });
      }

      const kyc = await KYC.findOne({ where: { userId } });
      if (!kyc) {
        return res.status(404).json({
          success: false,
          message: 'KYC submission not found. Please create submission first.'
        });
      }

      // Only allow updates if status is pending or rejected
      if (!['pending', 'rejected'].includes(kyc.status)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot upload documents in current status'
        });
      }

      const updateField = this.getDocumentField(documentType);
      if (!updateField) {
        return res.status(400).json({
          success: false,
          message: 'Invalid document type'
        });
      }

      await kyc.update({
        [updateField]: documentUrl
      });

      res.json({
        success: true,
        message: 'Document URL updated successfully',
        data: {
          documentType,
          documentUrl,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Update document URL error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Delete document
  async deleteDocument(req, res) {
    try {
      const userId = req.user.id;
      const { documentId } = req.params;
      
      const kyc = await KYC.findOne({ where: { userId } });
      if (!kyc) {
        return res.status(404).json({
          success: false,
          message: 'KYC submission not found'
        });
      }

      // Only allow deletion if status is pending or rejected
      if (!['pending', 'rejected'].includes(kyc.status)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete documents in current status'
        });
      }

      const updateField = this.getDocumentFieldById(documentId);
      if (!updateField || !kyc[updateField]) {
        return res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }

      // Just remove the URL from database
      // Cloudinary cleanup can be handled by admin or background jobs
      await kyc.update({
        [updateField]: null
      });

      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error) {
      console.error('Delete document error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get document types
  async getDocumentTypes(req, res) {
    try {
      const documentTypes = [
        {
          type: 'passport',
          label: 'Passport',
          description: 'Valid passport document',
          required: ['front', 'selfie']
        },
        {
          type: 'id_card',
          label: 'National ID Card',
          description: 'Government issued ID card',
          required: ['front', 'back', 'selfie']
        },
        {
          type: 'driving_license',
          label: 'Driving License',
          description: 'Valid driving license',
          required: ['front', 'back', 'selfie']
        }
      ];

      res.json({
        success: true,
        data: documentTypes
      });
    } catch (error) {
      console.error('Get document types error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Update personal info
  async updatePersonalInfo(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const { fullName, dateOfBirth, nationality, address } = req.body;

      const kyc = await KYC.findOne({ where: { userId } });
      if (!kyc) {
        return res.status(404).json({
          success: false,
          message: 'KYC submission not found'
        });
      }

      // Only allow updates if status is pending or rejected
      if (!['pending', 'rejected'].includes(kyc.status)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot update personal info in current status'
        });
      }

      const updateFields = {};
      if (fullName !== undefined) updateFields.fullName = fullName;
      if (dateOfBirth !== undefined) updateFields.dateOfBirth = dateOfBirth;
      if (nationality !== undefined) updateFields.nationality = nationality;
      if (address !== undefined) updateFields.address = address;

      await kyc.update(updateFields);

      res.json({
        success: true,
        message: 'Personal information updated successfully',
        data: {
          fullName: kyc.fullName,
          dateOfBirth: kyc.dateOfBirth,
          nationality: kyc.nationality,
          address: kyc.address,
          updatedAt: kyc.updatedAt
        }
      });
    } catch (error) {
      console.error('Update personal info error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get requirements by level
  async getRequirements(req, res) {
    try {
      const { level } = req.params;
      
      if (!['basic', 'intermediate', 'advanced'].includes(level)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification level'
        });
      }

      const requirements = this.getKycRequirements(level);

      res.json({
        success: true,
        data: {
          level,
          requirements
        }
      });
    } catch (error) {
      console.error('Get requirements error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Helper methods
  getKycLevel(status) {
    switch (status) {
      case 'approved':
        return 'basic';
      case 'pending':
        return 'pending';
      case 'rejected':
        return 'rejected';
      case 'expired':
        return 'expired';
      default:
        return 'none';
    }
  }

  getKycRequirements(level) {
    const requirements = {
      basic: {
        personalInfo: ['fullName', 'dateOfBirth', 'nationality'],
        documents: ['identity_document', 'selfie'],
        description: 'Basic verification for standard features'
      },
      intermediate: {
        personalInfo: ['fullName', 'dateOfBirth', 'nationality', 'address'],
        documents: ['identity_document', 'address_proof', 'selfie'],
        description: 'Enhanced verification for creator features'
      },
      advanced: {
        personalInfo: ['fullName', 'dateOfBirth', 'nationality', 'address'],
        documents: ['identity_document', 'address_proof', 'selfie', 'income_proof'],
        description: 'Full verification for premium features'
      }
    };

    return requirements[level] || requirements.basic;
  }

  getRequiredDocuments(documentType) {
    const documentRequirements = {
      'passport': ['front', 'selfie'],
      'id_card': ['front', 'back', 'selfie'],
      'driving_license': ['front', 'back', 'selfie']
    };
    return documentRequirements[documentType] || ['front', 'selfie'];
  }

  getDocumentField(documentType) {
    const fieldMap = {
      'front': 'documentFrontUrl',
      'back': 'documentBackUrl',
      'selfie': 'selfieUrl'
    };
    return fieldMap[documentType];
  }

  getDocumentFieldById(documentId) {
    const fieldMap = {
      'front': 'documentFrontUrl',
      'back': 'documentBackUrl',
      'selfie': 'selfieUrl'
    };
    return fieldMap[documentId];
  }

  isValidCloudinaryUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    const cloudinaryPattern = /^https:\/\/res\.cloudinary\.com\/[^\/]+\/(image|video|raw|auto)\/upload\//;
    return cloudinaryPattern.test(url);
  }
}

const kycController = new KYCController();

const boundMethods = {};
Object.getOwnPropertyNames(KYCController.prototype).forEach(methodName => {
  if (methodName !== 'constructor' && typeof kycController[methodName] === 'function') {
    boundMethods[methodName] = kycController[methodName].bind(kycController);
  }
});

module.exports = boundMethods;