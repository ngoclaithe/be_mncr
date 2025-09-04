const { User, Follow } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const { validationResult } = require('express-validator');

class FollowController {

  /**
   * @desc    Follow or unfollow a user
   * @route   POST /api/v1/follows/:userId/toggle
   * @access  Private (Authenticated users)
   */
  async toggleFollow(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, errors: errors.array() });
    }

    try {
      const followerId = req.user.id;
      const followingId = req.params.userId;

      if (followerId === followingId) {
        return next(new ApiError('You cannot follow yourself.', StatusCodes.BAD_REQUEST));
      }

      const userToFollow = await User.findByPk(followingId);
      if (!userToFollow) {
        return next(new ApiError('User to follow not found.', StatusCodes.NOT_FOUND));
      }

      const existingFollow = await Follow.findOne({
        where: { followerId, followingId }
      });

      if (existingFollow) {
        // Unfollow
        await existingFollow.destroy();
        res.status(StatusCodes.OK).json({
          success: true,
          message: `Successfully unfollowed user ${userToFollow.username}.`,
          data: { isFollowing: false }
        });
      } else {
        // Follow
        await Follow.create({ followerId, followingId });
        res.status(StatusCodes.OK).json({
          success: true,
          message: `Successfully followed user ${userToFollow.username}.`,
          data: { isFollowing: true }
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get a list of followers for a user
   * @route   GET /api/v1/follows/:userId/followers
   * @access  Public
   */
  async getFollowers(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, errors: errors.array() });
    }

    try {
      const { userId } = req.params;
      const { page = 1, limit = 15 } = req.query;
      const offset = (page - 1) * limit;

      const { count, rows } = await Follow.findAndCountAll({
        where: { followingId: userId },
        include: [{
          model: User,
          as: 'follower',
          attributes: ['id', 'username', 'avatar', 'firstName', 'lastName']
        }],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      const followers = rows.map(row => row.follower);

      res.status(StatusCodes.OK).json({
        success: true,
        data: followers,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get a list of users a user is following
   * @route   GET /api/v1/follows/:userId/following
   * @access  Public
   */
  async getFollowing(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(StatusCodes.BAD_REQUEST).json({ success: false, errors: errors.array() });
    }

    try {
        const { userId } = req.params;
        const { page = 1, limit = 15 } = req.query;
        const offset = (page - 1) * limit;

        const { count, rows } = await Follow.findAndCountAll({
            where: { followerId: userId },
            include: [{
                model: User,
                as: 'following',
                attributes: ['id', 'username', 'avatar', 'firstName', 'lastName']
            }],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        const followingList = rows.map(row => row.following);

        res.status(StatusCodes.OK).json({
            success: true,
            data: followingList,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        next(error);
    }
  }
}

module.exports = new FollowController();
