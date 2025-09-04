const { User, Creator, Follow, sequelize } = require('../../models');
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../../utils/ApiError');
const { validationResult } = require('express-validator');

/**
 * @desc    Follow a creator
 * @route   POST /api/v1/follows
 * @access  Private
 */
const follow = async (req, res, next) => {
  console.log('=== FOLLOW FUNCTION CALLED ===');
  console.log('req.body:', req.body);
  console.log('req.user:', req.user);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(StatusCodes.BAD_REQUEST).json({ success: false, errors: errors.array() });
  }

  const { creatorId } = req.body;
  const followerId = req.user.id;

  console.log('followerId:', followerId);
  console.log('creatorId:', creatorId);

  try {
    const result = await sequelize.transaction(async (t) => {
      console.log('Starting transaction...');
      
      // Check if target creator exists
      const targetCreator = await Creator.findByPk(creatorId, { transaction: t });
      console.log('Target creator found:', !!targetCreator);
      
      if (!targetCreator) {
        console.log('Target creator not found, throwing error');
        throw new ApiError('Creator not found', StatusCodes.NOT_FOUND);
      }

      // Check if user is trying to follow their own creator profile
      if (followerId === targetCreator.userId) {
        console.log('User trying to follow their own creator profile');
        throw new ApiError('You cannot follow yourself', StatusCodes.BAD_REQUEST);
      }

      console.log('Creating follow relationship...');
      const [follow, created] = await Follow.findOrCreate({
        where: { followerId, creatorId },
        defaults: { followerId, creatorId },
        transaction: t,
      });

      console.log('Follow created:', created);
      console.log('Follow object:', follow);

      if (!created) {
        console.log('Already following this creator');
        throw new ApiError('You are already following this creator', StatusCodes.BAD_REQUEST);
      }

      console.log('Transaction completed successfully');
      return { message: 'Successfully followed creator.' };
    });

    console.log('Sending success response');
    res.status(StatusCodes.CREATED).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.log('Error in follow function:', error);
    console.log('Error message:', error.message);
    console.log('Error status:', error.statusCode);
    next(error);
  }
};

/**
 * @desc    Unfollow a creator
 * @route   DELETE /api/v1/follows/:userId
 * @access  Private
 */
const unfollow = async (req, res, next) => {
  const { userId: creatorId } = req.params;
  const followerId = req.user.id;

  try {
    const result = await sequelize.transaction(async (t) => {
      // Check if target creator exists
      const targetCreator = await Creator.findByPk(creatorId, { transaction: t });
      if (!targetCreator) {
        throw new ApiError('Creator not found', StatusCodes.NOT_FOUND);
      }

      // Check if user is trying to unfollow their own creator profile
      if (followerId === targetCreator.userId) {
        throw new ApiError('You cannot unfollow yourself', StatusCodes.BAD_REQUEST);
      }

      const deletedCount = await Follow.destroy({
        where: {
          followerId,
          creatorId,
        },
        transaction: t,
      });

      if (deletedCount === 0) {
        throw new ApiError('You are not following this creator', StatusCodes.BAD_REQUEST);
      }

      return { message: 'Successfully unfollowed creator.' };
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get list of creators a user is following
 * @route   GET /api/v1/follows/:userId/following
 * @access  Public
 */
const getFollowingList = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const user = await User.findByPk(userId);
    if (!user) {
      return next(new ApiError('User not found', StatusCodes.NOT_FOUND));
    }

    // Get creators that this user is following
    const followingList = await Follow.findAll({
      where: { followerId: userId },
      include: [
        {
          model: Creator,
          as: 'creator',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'username', 'avatar', 'isOnline']
            }
          ]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Transform the data
    const transformedData = followingList.map(follow => {
      const creator = follow.creator;
      const user = creator.user;
      
      return {
        id: creator.id,
        userId: creator.userId,
        username: user.username || '',
        displayName: creator.stageName || 'Unknown Creator',
        stageName: creator.stageName,
        avatar: user.avatar,
        bio: creator.bio,
        role: 'creator',
        isVerified: creator.isVerified || false,
        isOnline: user.isOnline || false,
        isLive: creator.isLive || false,
        rating: creator.rating || 0,
        totalRatings: creator.totalRatings || 0,
        tags: creator.tags || [],
        isFollowing: true
      };
    });

    const totalCount = await Follow.count({
      where: { followerId: userId }
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: transformedData,
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
 * @desc    Get list of followers for a creator
 * @route   GET /api/v1/follows/:creatorId/followers
 * @access  Public
 */
const getFollowersList = async (req, res, next) => {
  try {
    const { userId: creatorId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const creator = await Creator.findByPk(creatorId);
    if (!creator) {
      return next(new ApiError('Creator not found', StatusCodes.NOT_FOUND));
    }

    // Get users that are following this creator
    const followersList = await Follow.findAll({
      where: { creatorId },
      include: [
        {
          model: User,
          as: 'follower',
          attributes: [
            'id', 'username', 'firstName', 'lastName', 
            'avatar', 'isOnline', 'role'
          ]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Transform the data
    const transformedData = followersList.map(follow => {
      const user = follow.follower;
      
      return {
        id: user.id,
        username: user.username || '',
        displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'Unknown User',
        avatar: user.avatar,
        role: user.role,
        isOnline: user.isOnline || false,
        followedAt: follow.createdAt
      };
    });

    const totalCount = await Follow.count({
      where: { creatorId }
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: transformedData,
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
 * @desc    Check if current user is following a specific creator
 * @route   GET /api/v1/follows/status/:creatorId
 * @access  Private
 */
const getFollowStatus = async (req, res, next) => {
  try {
    const { userId: creatorId } = req.params;
    const followerId = req.user.id;

    const follow = await Follow.findOne({
      where: {
        followerId,
        creatorId
      }
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        isFollowing: !!follow
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get mutual follows between users and creators they both follow
 * @route   GET /api/v1/follows/:userId/mutual
 * @access  Public
 */
const getMutualFollows = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const user = await User.findByPk(userId);
    if (!user) {
      return next(new ApiError('User not found', StatusCodes.NOT_FOUND));
    }

    // Get creators that both users follow (mutual following)
    const mutualFollows = await sequelize.query(`
      SELECT DISTINCT c.id, c.userId, c.stageName, c.bio, c.rating, c.totalRatings, 
             c.isVerified, c.isLive, c.tags, u.username, u.avatar, u.isOnline
      FROM Creators c
      INNER JOIN Users u ON c.userId = u.id
      INNER JOIN Follows f1 ON c.id = f1.creatorId AND f1.followerId = :userId
      INNER JOIN Follows f2 ON c.id = f2.creatorId AND f2.followerId != :userId
      ORDER BY c.stageName
      LIMIT :limit OFFSET :offset
    `, {
      replacements: { 
        userId: parseInt(userId), 
        limit: parseInt(limit), 
        offset: parseInt(offset) 
      },
      type: sequelize.QueryTypes.SELECT
    });

    // Transform the data
    const transformedData = mutualFollows.map(creator => ({
      id: creator.id,
      userId: creator.userId,
      username: creator.username || '',
      displayName: creator.stageName || 'Unknown Creator',
      stageName: creator.stageName,
      avatar: creator.avatar,
      bio: creator.bio,
      role: 'creator',
      isVerified: creator.isVerified || false,
      isOnline: creator.isOnline || false,
      isLive: creator.isLive || false,
      rating: creator.rating || 0,
      totalRatings: creator.totalRatings || 0,
      tags: creator.tags || [],
      isFollowing: true
    }));

    // Get total count of mutual follows
    const totalCountResult = await sequelize.query(`
      SELECT COUNT(DISTINCT c.id) as count
      FROM Creators c
      INNER JOIN Follows f1 ON c.id = f1.creatorId AND f1.followerId = :userId
      INNER JOIN Follows f2 ON c.id = f2.creatorId AND f2.followerId != :userId
    `, {
      replacements: { userId: parseInt(userId) },
      type: sequelize.QueryTypes.SELECT
    });

    const totalCount = totalCountResult[0].count;

    res.status(StatusCodes.OK).json({
      success: true,
      data: transformedData,
      pagination: {
        total: parseInt(totalCount),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getPublicInfoUser = async (req, res, next) => {
    try {
        const { userId } = req.params;

        // Tìm thông tin user
        const user = await User.findByPk(userId, {
            attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        });

        if (!user) {
            throw new ApiError('User not found', StatusCodes.NOT_FOUND);
        }

        // Tìm danh sách following với thông tin creator
        const followingList = await Follow.findAll({
            where: { followerId: userId },
            include: [
                {
                    model: Creator,
                    as: 'creator',
                    attributes: ['id', 'stageName'], // Thêm stageName
                    include: [
                        {
                            model: User,
                            as: 'user',
                            attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Transform data để có định dạng mong muốn
        const transformedFollowing = followingList.map(follow => {
            const creator = follow.creator;
            const creatorUser = creator.user;
            return {
                creatorId: creator.id,
                stageName: creator.stageName, // Thêm stageName
                userId: creatorUser.id,
                username: creatorUser.username,
                firstName: creatorUser.firstName,
                lastName: creatorUser.lastName,
                avatar: creatorUser.avatar,
                followedAt: follow.createdAt // Thời gian follow
            };
        });

        // Tính số lượng người đang follow
        const followingCount = transformedFollowing.length;

        // Trả về response với đầy đủ thông tin
        res.status(StatusCodes.OK).json({
            success: true,
            message: 'User public information retrieved successfully',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    avatar: user.avatar
                },
                followingCount: followingCount,
                following: transformedFollowing
            }
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
  follow,
  unfollow,
  getFollowingList,
  getFollowersList,
  getPublicInfoUser,
  getFollowStatus,
  getMutualFollows,
};