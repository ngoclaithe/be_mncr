const express = require('express');
const router = express.Router();
const postController = require('../../controllers/social/postController');
const { protect, authorize } = require('../../middleware/auth');
const { optionalAuth, flexibleAuth } = require('../../middleware/optionalAuth');

const {
  createPostValidation,
  updatePostValidation,
  getPostsValidation,
  getFeedValidation,
  searchPostsValidation,
  validatePostId,
  validateUserId,
  validateCreatorId,
  validateTrendingQuery
} = require('../../middleware/validation/postValidation');
const { validationResult } = require('express-validator');

// Validation middleware to handle validation errors
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }
  next();
};

// Public routes (no authentication required)
router.get('/', 
  optionalAuth(),
  getPostsValidation, 
  handleValidation, 
  postController.getAllPosts
);

router.get('/search', 
  searchPostsValidation, 
  handleValidation, 
  postController.searchPosts
);

router.get('/trending', 
  validateTrendingQuery, 
  handleValidation, 
  postController.getTrendingPosts
);

router.get('/user/:userId', 
  validateUserId, 
  getPostsValidation, 
  handleValidation, 
  postController.getUserPosts
);

router.get('/creator/:creatorId', 
  validateCreatorId, 
  getPostsValidation, 
  handleValidation, 
  postController.getCreatorPosts
);

router.get('/:id', 
  validatePostId, 
  handleValidation, 
  postController.getPostById
);

// Protected routes
router.use(protect); 

router.post('/', 
  createPostValidation, 
  handleValidation, 
  postController.createPost
);

// router.get('/feed/', 
//   getPostsValidation, 
//   handleValidation, 
//   postController.getAllPosts
// );

router.get('/feed/followed', 
  getFeedValidation, 
  handleValidation, 
  postController.getFeedPosts
);

router.get('/feed/premium', 
  getFeedValidation, 
  handleValidation, 
  postController.getPremiumFeedPosts
);

router.put('/:id', 
  validatePostId, 
  updatePostValidation, 
  handleValidation, 
  postController.updatePost
);

router.delete('/:id', 
  validatePostId, 
  handleValidation, 
  postController.deletePost
);

module.exports = router;