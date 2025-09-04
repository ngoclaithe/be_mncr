const express = require('express');
const router = express.Router();
const creatorController = require('../../controllers/creator/creatorController');
const followRoutes = require('./followRoutes');
const { protect } = require('../../middleware/auth');
const { getCreatorsValidator } = require('../../middleware/validation/creatorValidation');

// @route   GET /api/v1/creators
// @desc    Get a list of all creators
// @access  Public
router.get('/', getCreatorsValidator, creatorController.getCreators);

// @route   GET /api/v1/creators/search
// @desc    Search creators
// @access  Public
router.get('/search', creatorController.searchCreators);

// @route   GET /api/v1/creators/verified
// @desc    Get verified creators
// @access  Public
router.get('/verified', creatorController.getVerifiedCreators);

// @route   GET /api/v1/creators/live
// @desc    Get live creators
// @access  Public
router.get('/featured', creatorController.getFeaturedCreators);
router.get('/live', creatorController.getLiveCreators);

// @route   GET /api/v1/creators/:id
// @desc    Get a single creator by ID
// @access  Public
router.get('/:id', creatorController.getCreatorById);

// Follow routes (protected)
router.use('/me', protect, followRoutes);

module.exports = router;