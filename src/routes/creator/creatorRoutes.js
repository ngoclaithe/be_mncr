const express = require('express');
const router = express.Router();
const creatorController = require('../../controllers/creator/creatorController');
const followRoutes = require('./followRoutes');
const { protect, authorize } = require('../../middleware/auth');
const { optionalAuth } = require('../../middleware/optionalAuth');
const { getCreatorsValidator, updateCreatorValidator } = require('../../middleware/validation/creatorValidation');

// @route   GET /api/v2/creators
// @desc    Get a list of all creators
// @access  Public
router.get('/', getCreatorsValidator, creatorController.getCreators);

// @route   GET /api/v2/creators/search
// @desc    Search creators
// @access  Public
router.get('/search', creatorController.searchCreators);

// @route   GET /api/v2/creators/callgirls
// @desc    Search callgirl creators
// @access  Public
router.get('/callgirls', creatorController.getCallgirlCreators);

// @route   GET /api/v2/creators/verified
// @desc    Get verified creators
// @access  Public
router.get('/verified', creatorController.getVerifiedCreators);

// @route   GET /api/v2/creators/live
// @desc    Get live creators
// @access  Public
router.get('/featured', creatorController.getFeaturedCreators);
router.get('/live', creatorController.getLiveCreators);
router.get('/related/:id', creatorController.getRelatedCreators);
// @route   GET /api/v2/creators/:id
// @desc    Get a single creator by ID
// @access  Public
router.get('/:id', optionalAuth(), creatorController.getCreatorById);

// @route   PUT /api/v2/creators/:id
// @desc    Update creator information
// @access  Private (Creator/Admin)
router.put('/:id', protect, authorize('creator', 'admin'), updateCreatorValidator, creatorController.updateCreator);

// Follow routes (protected)
router.use('/me', protect, followRoutes);

module.exports = router;