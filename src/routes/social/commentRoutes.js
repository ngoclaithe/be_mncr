const express = require('express');
const router = express.Router();
const commentController = require('../../controllers/social/commentController');
const { protect, checkOwnership } = require('../../middleware/auth');
const { Comment } = require('../../models');
const { 
    createCommentValidator,
    updateCommentValidator,
    commentIdValidator,
    commentParamIdValidator,
    postIdValidator
} = require('../../middleware/validation/commentValidation');

/**
 * @desc    Create comment for a post
 * @route   POST /api/posts/:postId/comments
 * @access  Private
 */
router.route('/posts/:postId/comments')
  .post(
    protect,
    postIdValidator,
    createCommentValidator,
    commentController.createComment
  )
  .get(
    postIdValidator,
    commentController.getPostComments
  );

/**
 * @desc    Get, Update, Delete specific comment
 * @route   GET/PUT/DELETE /api/comments/:id
 * @access  GET: Public, PUT/DELETE: Private (Owner/Admin only)
 */
router.route('/:id')
  .get(
    commentIdValidator,
    commentController.getCommentById
  )
  .put(
    protect, 
    commentIdValidator,
    updateCommentValidator,
    checkOwnership(Comment, 'id', 'userId'),
    commentController.updateComment
  )
  .delete(
    protect,
    commentIdValidator,
    checkOwnership(Comment, 'id', 'userId'),
    commentController.deleteComment
  );

/**
 * @desc    Get replies for a comment
 * @route   GET /api/comments/:commentId/replies
 * @access  Public
 */
router.route('/:commentId/replies')
  .get(
    commentParamIdValidator('commentId'),
    commentController.getRepliesForComment
  );

/**
 * @desc    Create reply to a comment
 * @route   POST /api/comments/:commentId/replies
 * @access  Private
 */
router.route('/:commentId/replies')
  .post(
    protect,
    commentParamIdValidator('commentId'),
    createCommentValidator,
    commentController.createReply
  );

module.exports = router;