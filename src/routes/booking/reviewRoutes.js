const express = require('express');
const router = express.Router();
const {
    postReview,
    getReviews,
    getReviewById,
    updateReview,
    deleteReview,
    getUserPublicReviews,
    respondToReview
} = require('../../controllers/booking/reviewController');

const { protect } = require('../../middleware/auth');
const {
    validateCreateReview,
    validateUpdateReview,
    validateReviewResponse,
    validateGetReviews
} = require('../../middleware/validation/reviewValidation.js');

// Public routes
router.get('/all', getAllReviews);
router.get('/creator/:creatorId', validateGetReviews, getReviews);
router.get('/user-public/:userId', getUserPublicReviews);
router.get('/:id', getReviewById);

// Protected routes - require authentication
router.use(protect);

// User routes
router.post('/', validateCreateReview, postReview);
router.put('/:id', validateUpdateReview, updateReview);
router.delete('/:id', deleteReview);

// Creator response route
router.put('/:id/respond', validateReviewResponse, respondToReview);

module.exports = router;