const { User, Follow, sequelize } = require('../../models');
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../../utils/ApiError');
const { validationResult } = require('express-validator');

/**
 * @desc    Get the current creator's followers
 * @route   GET /api/v1/creators/me/followers
 * @access  Private (Creator)
 */
const getMyFollowers = async (req, res, next) => {
  try {
    const creatorId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const creator = await User.findByPk(creatorId);
    if (!creator) {
      return next(new ApiError('Creator not found', StatusCodes.NOT_FOUND));
    }

    const followers = await creator.getFollowers({
      attributes: ['id', 'username', 'displayName', 'avatar'],
      joinTableAttributes: [],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
    });

    const totalCount = await creator.countFollowers();

    res.status(StatusCodes.OK).json({
      success: true,
      data: followers,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove a follower from the current creator's followers list
 * @route   DELETE /api/v1/creators/me/followers/:followerId
 * @access  Private (Creator)
 */
const removeFollower = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({ success: false, errors: errors.array() });
  }

  const { followerId } = req.params;
  const creatorId = req.user.id;

  if (parseInt(followerId, 10) === creatorId) {
    return next(new ApiError('You cannot remove yourself as a follower.', StatusCodes.BAD_REQUEST));
  }

  try {
    const result = await sequelize.transaction(async (t) => {
      const deletedCount = await Follow.destroy({
        where: {
          followerId: followerId,
          followingId: creatorId,
        },
        transaction: t,
      });

      if (deletedCount === 0) {
        throw new ApiError('This user is not your follower.', StatusCodes.BAD_REQUEST);
      }

      await User.decrement('followersCount', { by: 1, where: { id: creatorId }, transaction: t });
      await User.decrement('followingCount', { by: 1, where: { id: followerId }, transaction: t });

      return { message: 'Follower removed successfully.' };
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyFollowers,
  removeFollower,
};