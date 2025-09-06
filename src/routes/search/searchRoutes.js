const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const searchController = require('../../controllers/search/searchController');
const { protect, authorize } = require('../../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiting cho search API
const searchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 phút
  max: 30, // 30 requests per minute
  message: {
    success: false,
    message: 'Too many search requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation middleware chung cho search
const validateSearchQuery = [
  query('query')
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters')
    .trim()
    .escape(), // XSS protection
  query('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Limit must be between 1 and 20')
    .toInt()
];

// ==================== SEARCH ROUTES ====================

/**
 * @route   GET /api/search/all
 * @desc    Search across all content types (users, creators, posts)
 * @access  Public
 * @params  query, limit
 */
router.get('/all', 
  searchRateLimit,
  validateSearchQuery, 
  searchController.searchAll
);

/**
 * @route   GET /api/search/users
 * @desc    Search only users
 * @access  Public
 * @params  query, limit
 */
router.get('/users', 
  searchRateLimit,
  validateSearchQuery, 
  searchController.searchUsers
);

/**
 * @route   GET /api/search/creators
 * @desc    Search only creators
 * @access  Public
 * @params  query, limit
 */
router.get('/creators', 
  searchRateLimit,
  validateSearchQuery, 
  searchController.searchCreators
);

/**
 * @route   GET /api/search/posts
 * @desc    Search only posts
 * @access  Public
 * @params  query, limit
 */
router.get('/posts', 
  searchRateLimit,
  validateSearchQuery, 
  searchController.searchPosts
);

/**
 * @route   GET /api/search/similarity
 * @desc    Test similarity calculation between strings
 * @access  Public (for testing)
 * @params  str1, str2
 */
router.get('/similarity',
  searchRateLimit,
  [
    query('str1')
      .notEmpty()
      .withMessage('First string is required')
      .trim(),
    query('str2')
      .notEmpty()
      .withMessage('Second string is required')
      .trim()
  ],
  (req, res) => {
    const { str1, str2 } = req.query;
    const similarity = searchController.calculateSimilarity(str1, str2);
    
    res.json({
      success: true,
      data: {
        str1,
        str2,
        similarity: Math.round(similarity * 100) / 100,
        percentage: Math.round(similarity * 10000) / 100 + '%'
      }
    });
  }
);

/**
 * @route   GET /api/search/relevance
 * @desc    Test relevance score calculation
 * @access  Public (for testing)
 * @params  query, content, type
 */
router.get('/relevance',
  searchRateLimit,
  [
    query('query')
      .notEmpty()
      .withMessage('Query is required')
      .trim(),
    query('content')
      .notEmpty()
      .withMessage('Content is required')
      .trim(),
    query('type')
      .optional()
      .isIn(['user', 'creator', 'post'])
      .withMessage('Type must be one of: user, creator, post')
  ],
  (req, res) => {
    const { query, content, type = 'user' } = req.query;
    
    // Mock item for testing
    const mockItem = {
      username: content,
      firstName: content,
      lastName: content,
      stageName: content,
      bio: content,
      content: content
    };
    
    const searchFields = type === 'user' 
      ? ['username', 'firstName', 'lastName']
      : type === 'creator'
      ? ['stageName', 'bio']
      : ['content'];
    
    const relevanceScore = searchController.calculateRelevanceScore(
      mockItem, 
      query, 
      searchFields
    );
    
    res.json({
      success: true,
      data: {
        query,
        content,
        type,
        relevanceScore: Math.round(relevanceScore),
        grade: relevanceScore >= 80 ? 'Excellent' :
               relevanceScore >= 60 ? 'Good' :
               relevanceScore >= 40 ? 'Fair' : 'Poor'
      }
    });
  }
);

module.exports = router;