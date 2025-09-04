const { Story, User, Follow } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

// Helper để tính toán thời điểm hết hạn của story (24 giờ trước)
const getStoryExpirationDate = () => {
  return new Date(new Date() - 24 * 60 * 60 * 1000);
};

class StoryController {

  /**
   * @desc    Create a new story
   * @route   POST /api/v1/stories
   * @access  Private
   */
  async createStory(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, errors: errors.array() });
    }

    try {
      if (!req.file) {
        return next(new ApiError('Media file is required to create a story.', StatusCodes.BAD_REQUEST));
      }

      const { content, mediaType } = req.body;
      const userId = req.user.id;
      const mediaUrl = req.file.path; // Giả định middleware upload file lưu đường dẫn tại đây

      const newStory = await Story.create({
        userId,
        content,
        mediaType,
        mediaUrl
      });

      const storyWithUser = await Story.findByPk(newStory.id, {
        include: {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'avatar']
        }
      });

      res.status(StatusCodes.CREATED).json({
        success: true,
        data: storyWithUser
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get story feed for the logged-in user (stories from followed users)
   * @route   GET /api/v1/stories
   * @access  Private
   */
  async getStoryFeed(req, res, next) {
    try {
      const userId = req.user.id;

      // Tìm tất cả user mà người dùng hiện tại đang theo dõi
      const following = await Follow.findAll({
        where: { followerId: userId },
        attributes: ['followingId']
      });
      const followingIds = following.map(f => f.followingId);

      // Người dùng cũng nên thấy story của chính mình
      const userIdsToFetch = [userId, ...followingIds];

      // Tìm tất cả story chưa hết hạn của các user này
      const stories = await Story.findAll({
        where: {
          userId: { [Op.in]: userIdsToFetch },
          createdAt: { [Op.gte]: getStoryExpirationDate() }
        },
        include: {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'avatar']
        },
        order: [['userId', 'ASC'], ['createdAt', 'ASC']]
      });

      // Nhóm các story lại theo từng user
      const groupedStories = stories.reduce((acc, story) => {
        const user = story.user.toJSON();
        if (!acc[user.id]) {
          acc[user.id] = { user, stories: [] };
        }
        const { user: _, ...storyData } = story.toJSON();
        acc[user.id].stories.push(storyData);
        return acc;
      }, {});

      res.status(StatusCodes.OK).json({
        success: true,
        data: Object.values(groupedStories)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Delete a story
   * @route   DELETE /api/v1/stories/:storyId
   * @access  Private (Owner only)
   */
  async deleteStory(req, res, next) {
    try {
      const story = req.resource; 
      // Cân nhắc thêm logic để xóa file media tương ứng khỏi storage (S3, local disk, etc.)
      await story.destroy();
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StoryController();