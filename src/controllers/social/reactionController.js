const { Reaction, Post, Comment } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const { validationResult } = require('express-validator');

class ReactionController {

  /**
   * @desc    Add, update, or remove a reaction on a post or comment
   * @route   POST /api/v1/posts/:postId/reactions
   * @route   POST /api/v1/comments/:commentId/reactions
   * @access  Private (Authenticated users)
   */
  async toggleReaction(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, errors: errors.array() });
    }

    try {
      const { postId, commentId } = req.body;
      const { reactionType } = req.body;
      const userId = req.user.id;

      // Debug: Log dữ liệu đầu vào
      console.log('Debug - Input data:', {
        postId,
        commentId,
        reactionType,
        userId,
        userObject: req.user
      });

      let targetId;
      let targetType;
      let Model;

      if (postId) {
        targetId = postId;
        targetType = 'post';
        Model = Post;
      } else if (commentId) {
        targetId = commentId;
        targetType = 'comment';
        Model = Comment;
      } else {
        return next(new ApiError('A valid post or comment ID is required.', StatusCodes.BAD_REQUEST));
      }

      // Debug: Log target info
      console.log('Debug - Target info:', { targetId, targetType });

      // Kiểm tra xem đối tượng (post/comment) có tồn tại không
      const entity = await Model.findByPk(targetId);
      if (!entity) {
        return next(new ApiError(`${targetType} not found`, StatusCodes.NOT_FOUND));
      }

      console.log('Debug - Entity found:', entity.id);

      // Tìm reaction đã có của user trên đối tượng này
      const existingReaction = await Reaction.findOne({
        where: { userId, targetId, targetType }
      });

      console.log('Debug - Existing reaction:', existingReaction);

      if (existingReaction) {
        // Nếu reaction mới giống reaction cũ -> xóa (toggle off)
        if (existingReaction.reactionType === reactionType) {
          await existingReaction.destroy();
          return res.status(StatusCodes.OK).json({
            success: true,
            message: 'Reaction removed',
            data: null
          });
        } else {
          // Nếu reaction mới khác reaction cũ -> cập nhật
          existingReaction.reactionType = reactionType;
          await existingReaction.save();
          return res.status(StatusCodes.OK).json({
            success: true,
            message: 'Reaction updated',
            data: existingReaction
          });
        }
      } else {
        // Debug: Log dữ liệu sẽ được tạo
        const createData = {
          userId,
          targetId,
          targetType,
          reactionType
        };
        console.log('Debug - Data to create:', createData);

        // Kiểm tra model attributes
        console.log('Debug - Reaction model attributes:', Object.keys(Reaction.rawAttributes));

        try {
          // Nếu chưa có reaction -> tạo mới
          const newReaction = await Reaction.create(createData);
          
          console.log('Debug - Created reaction:', newReaction);
          
          return res.status(StatusCodes.CREATED).json({
            success: true,
            message: 'Reaction added',
            data: newReaction
          });
        } catch (createError) {
          console.error('Debug - Create error details:', {
            message: createError.message,
            sql: createError.sql,
            parameters: createError.parameters,
            original: createError.original
          });
          
          // Ném lại lỗi để error handler xử lý
          throw createError;
        }
      }
    } catch (error) {
      console.error('Debug - Controller error:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        sql: error.sql,
        original: error.original
      });
      next(error);
    }
  }

  /**
   * @desc    Get reactions for a specific target (post/comment)
   * @route   GET /api/v1/posts/:postId/reactions
   * @route   GET /api/v1/comments/:commentId/reactions
   * @access  Public
   */
  async getReactions(req, res, next) {
    try {
      const { postId, commentId } = req.params;
      
      let targetId;
      let targetType;

      if (postId) {
        targetId = postId;
        targetType = 'post';
      } else if (commentId) {
        targetId = commentId;
        targetType = 'comment';
      } else {
        return next(new ApiError('A valid post or comment ID is required.', StatusCodes.BAD_REQUEST));
      }

      const reactions = await Reaction.findAll({
        where: { targetId, targetType },
        attributes: ['reactionType', 'userId', 'createdAt']
      });

      // Group reactions by type and count
      const reactionCounts = reactions.reduce((acc, reaction) => {
        acc[reaction.reactionType] = (acc[reaction.reactionType] || 0) + 1;
        return acc;
      }, {});

      return res.status(StatusCodes.OK).json({
        success: true,
        data: {
          reactions,
          counts: reactionCounts,
          total: reactions.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReactionController();