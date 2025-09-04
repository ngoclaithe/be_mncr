const { Comment, Post, User, Creator } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const logger = require('../../utils/logger');
const { Op } = require('sequelize');

/**
 * @desc    Create comment for a post
 * @route   POST /api/posts/:postId/comments
 * @access  Private
 */
const createComment = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Check if post exists and is accessible
    const post = await Post.findByPk(postId);
    if (!post) {
      throw new ApiError('Post not found', StatusCodes.NOT_FOUND);
    }

    // Check if post is public or user has access
    if (!post.isPublic && post.userId !== userId) {
      throw new ApiError('Cannot comment on private post', StatusCodes.FORBIDDEN);
    }

    // Create comment
    const comment = await Comment.create({
      userId,
      postId,
      content,
      parentCommentId: null // This is a root comment
    });

    // Increment comment count on post
    await post.increment('commentCount');

    // Fetch created comment with associations
    const createdComment = await Comment.findByPk(comment.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        }
      ]
    });

    logger.info(`Comment created successfully by user ${userId} on post ${postId}`);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Comment created successfully',
      data: createdComment
    });

  } catch (error) {
    logger.error('Error creating comment:', error);
    next(error);
  }
};

/**
 * @desc    Get comments for a post
 * @route   GET /api/posts/:postId/comments
 * @access  Public
 */
const getPostComments = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;

    // Check if post exists
    const post = await Post.findByPk(postId);
    if (!post) {
      throw new ApiError('Post not found', StatusCodes.NOT_FOUND);
    }

    // Check if post is accessible
    if (!post.isPublic && (!req.user || post.userId !== req.user.id)) {
      throw new ApiError('Cannot access comments of private post', StatusCodes.FORBIDDEN);
    }

    // Get root comments (no parent)
    const { count, rows: comments } = await Comment.findAndCountAll({
      where: {
        postId,
        parentCommentId: null,
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        },
        {
          model: Comment,
          as: 'replies',
          limit: 3, // Show first 3 replies
          order: [['createdAt', 'ASC']],
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
            }
          ],
          required: false
        }
      ],
      order: [[sortBy, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    const totalPages = Math.ceil(count / limit);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Post comments retrieved successfully',
      data: {
        comments,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalComments: count,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    logger.error('Error getting post comments:', error);
    next(error);
  }
};

/**
 * @desc    Get comment by ID
 * @route   GET /api/comments/:id
 * @access  Public
 */
const getCommentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        },
        {
          model: Post,
          as: 'post',
          attributes: ['id', 'userId', 'isPublic']
        },
        {
          model: Comment,
          as: 'replies',
          limit: 5,
          order: [['createdAt', 'ASC']],
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
            }
          ],
          required: false
        }
      ]
    });

    if (!comment) {
      throw new ApiError('Comment not found', StatusCodes.NOT_FOUND);
    }

    // Check if comment's post is accessible
    if (!comment.post.isPublic && (!req.user || comment.post.userId !== req.user.id)) {
      throw new ApiError('Cannot access comment from private post', StatusCodes.FORBIDDEN);
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Comment retrieved successfully',
      data: comment
    });

  } catch (error) {
    logger.error('Error getting comment:', error);
    next(error);
  }
};

/**
 * @desc    Update comment
 * @route   PUT /api/comments/:id
 * @access  Private (Owner only)
 */
const updateComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    const comment = await Comment.findByPk(id, {
      include: [
        {
          model: Post,
          as: 'post',
          attributes: ['id', 'userId', 'isPublic']
        }
      ]
    });

    if (!comment) {
      throw new ApiError('Comment not found', StatusCodes.NOT_FOUND);
    }

    // Check ownership (already handled by middleware, but double-check)
    if (comment.userId !== userId && req.user.role !== 'admin') {
      throw new ApiError('Not authorized to update this comment', StatusCodes.FORBIDDEN);
    }

    // Update comment
    comment.content = content;
    comment.isEdited = true;
    await comment.save();

    // Fetch updated comment with associations
    const updatedComment = await Comment.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        }
      ]
    });

    logger.info(`Comment ${id} updated by user ${userId}`);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Comment updated successfully',
      data: updatedComment
    });

  } catch (error) {
    logger.error('Error updating comment:', error);
    next(error);
  }
};

/**
* @desc    Delete comment
* @route   DELETE /api/comments/:id
* @access  Private (Owner/Admin only)
*/
const deleteComment = async (req, res, next) => {
 try {
   const { id } = req.params;
   const userId = req.user.id;

   const comment = await Comment.findByPk(id, {
     include: [
       {
         model: Post,
         as: 'post',
         attributes: ['id', 'userId', 'commentCount']
       }
     ]
   });

   if (!comment) {
     throw new ApiError('Comment not found', StatusCodes.NOT_FOUND);
   }

   // Check ownership (middleware already handles this, but double-check)
   if (comment.userId !== userId && req.user.role !== 'admin') {
     throw new ApiError('Not authorized to delete this comment', StatusCodes.FORBIDDEN);
   }

   // Hard delete the comment
   await comment.destroy();

   // Decrement comment count on post
   await comment.post.decrement('commentCount');

   logger.info(`Comment ${id} deleted by user ${userId}`);

   res.status(StatusCodes.OK).json({
     success: true,
     message: 'Comment deleted successfully'
   });

 } catch (error) {
   logger.error('Error deleting comment:', error);
   next(error);
 }
};

/**
 * @desc    Get replies for a comment
 * @route   GET /api/comments/:commentId/replies
 * @access  Public
 */
const getRepliesForComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'ASC'
    } = req.query;

    const offset = (page - 1) * limit;

    // Check if parent comment exists
    const parentComment = await Comment.findByPk(commentId, {
      include: [
        {
          model: Post,
          as: 'post',
          attributes: ['id', 'userId', 'isPublic']
        }
      ]
    });

    if (!parentComment) {
      throw new ApiError('Parent comment not found', StatusCodes.NOT_FOUND);
    }

    // Check if comment's post is accessible
    if (!parentComment.post.isPublic && (!req.user || parentComment.post.userId !== req.user.id)) {
      throw new ApiError('Cannot access replies from private post', StatusCodes.FORBIDDEN);
    }

    // Get replies
    const { count, rows: replies } = await Comment.findAndCountAll({
      where: {
        parentCommentId: commentId,
        status: 'active'
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        }
      ],
      order: [[sortBy, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    const totalPages = Math.ceil(count / limit);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Comment replies retrieved successfully',
      data: {
        replies,
        parentCommentId: commentId,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalReplies: count,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    logger.error('Error getting comment replies:', error);
    next(error);
  }
};

/**
 * @desc    Create reply to a comment
 * @route   POST /api/comments/:commentId/replies
 * @access  Private
 */
const createReply = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Check if parent comment exists
    const parentComment = await Comment.findByPk(commentId, {
      include: [
        {
          model: Post,
          as: 'post',
          attributes: ['id', 'userId', 'isPublic']
        }
      ]
    });

    if (!parentComment) {
      throw new ApiError('Parent comment not found', StatusCodes.NOT_FOUND);
    }

    // Check if post is accessible
    if (!parentComment.post.isPublic && parentComment.post.userId !== userId) {
      throw new ApiError('Cannot reply to comment on private post', StatusCodes.FORBIDDEN);
    }

    // Create reply
    const reply = await Comment.create({
      userId,
      postId: parentComment.postId,
      content,
      parentCommentId: commentId
    });

    // Increment comment count on post
    await parentComment.post.increment('commentCount');

    // Fetch created reply with associations
    const createdReply = await Comment.findByPk(reply.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        }
      ]
    });

    logger.info(`Reply created successfully by user ${userId} on comment ${commentId}`);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Reply created successfully',
      data: createdReply
    });

  } catch (error) {
    logger.error('Error creating reply:', error);
    next(error);
  }
};

module.exports = {
  createComment,
  getPostComments,
  getCommentById,
  updateComment,
  deleteComment,
  getRepliesForComment,
  createReply
};