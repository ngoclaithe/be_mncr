const { Post, User, Creator, Comment, Follow, Reaction, Share } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const logger = require('../../utils/logger');
const config = require('../../config');
const { Op, Sequelize } = require('sequelize');

/**
 * @desc    Create new post
 * @route   POST /api/posts
 * @access  Private
 */
const createPost = async (req, res, next) => {
  try {
    const {
      content,
      mediaUrls = [],
      thumbnailUrl,
      isPublic = true,
      isPremium = false,
      price,
      scheduledAt,
      tags = [],
      location
    } = req.body;

    const userId = req.user.id;

    // Validate required fields
    if (!content && (!mediaUrls || mediaUrls.length === 0)) {
      throw new ApiError('Content or media is required', StatusCodes.BAD_REQUEST);
    }

    // If premium post, price is required
    if (isPremium && !price) {
      throw new ApiError('Price is required for premium posts', StatusCodes.BAD_REQUEST);
    }

    // Check if user is creator (luôn check, không chỉ khi premium)
    let creatorId = null;
    const creator = await Creator.findOne({ where: { userId } });
    if (creator) {
      creatorId = creator.id;
    }

    // If premium post, must be creator
    if (isPremium && !creator) {
      throw new ApiError('Only creators can create premium posts', StatusCodes.FORBIDDEN);
    }

    // Auto-determine mediaType based on mediaUrls
    let mediaType = 'text';
    if (mediaUrls && mediaUrls.length > 0) {
      // Helper function to determine if URL is video
      const isVideoUrl = (url) => {
        const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'];
        const videoMimeTypes = ['video/', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'];
        
        const urlLower = url.toLowerCase();
        
        // Check by file extension
        const hasVideoExtension = videoExtensions.some(ext => urlLower.includes(ext));
        
        // Check by common video hosting patterns
        const isVideoHosting = urlLower.includes('youtube.com') || 
                              urlLower.includes('youtu.be') || 
                              urlLower.includes('vimeo.com') ||
                              urlLower.includes('twitch.tv') ||
                              urlLower.includes('.mp4') ||
                              urlLower.includes('video');
        
        return hasVideoExtension || isVideoHosting;
      };

      // Check if any of the URLs are video
      const hasVideo = mediaUrls.some(url => isVideoUrl(url));
      
      if (hasVideo) {
        mediaType = 'video';
      } else {
        mediaType = 'image';
      }
    }

    // Determine initial status
    let status = 'published';
    if (scheduledAt && new Date(scheduledAt) > new Date()) {
      status = 'draft';
    }

    const post = await Post.create({
      userId,
      creatorId,
      content,
      mediaType,
      mediaUrls,
      thumbnailUrl,
      isPublic,
      isPremium,
      price,
      scheduledAt,
      tags,
      location,
      status
    });

    // Fetch post with associations
    const createdPost = await Post.findByPk(post.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        },
        {
          model: Creator,
          as: 'creator',
          attributes: ['id', 'stageName']
        }
      ]
    });

    logger.info(`Post created successfully by user ${userId} with mediaType: ${mediaType}`);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Post created successfully',
      data: createdPost
    });

  } catch (error) {
    logger.error('Error creating post:', error);
    next(error);
  }
};

/**
 * @desc    Get all posts with pagination and filters
 * @route   GET /api/posts
 * @access  Public
 */
const getAllPosts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      userId,
      creatorId,
      mediaType,
      isPublic,
      isPremium,
      status = 'published',
      tags,
      sortBy = 'createdAt',
      order = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const currentUserId = req.user?.id; // Lấy userId từ token nếu có

    // Debug log
    console.log('Current user ID:', currentUserId);

    // Build where conditions
    const whereConditions = {
      status
    };

    if (userId) whereConditions.userId = userId;
    if (creatorId) whereConditions.creatorId = creatorId;
    if (mediaType) whereConditions.mediaType = mediaType;
    if (isPublic !== undefined) whereConditions.isPublic = isPublic === 'true';
    if (isPremium !== undefined) whereConditions.isPremium = isPremium === 'true';
    
    if (tags) {
      const tagArray = tags.split(',');
      whereConditions.tags = {
        [Op.overlap]: tagArray
      };
    }

    // If not authenticated user, only show public posts
    if (!req.user) {
      whereConditions.isPublic = true;
      whereConditions.isPremium = false;
    }

    const { count, rows: posts } = await Post.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        },
        {
          model: Creator,
          as: 'creator',
          attributes: ['id', 'stageName'],
          required: false
        }
      ],
      order: [[sortBy, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    let postsWithReactions = posts.map(post => post.toJSON());

    // Chỉ lấy thông tin reactions nếu có token (user đã đăng nhập)
    if (currentUserId) {
      console.log('User logged in, fetching reactions...');
      
      const postIds = posts.map(post => post.id);
      console.log('Post IDs:', postIds);
      
      // Đếm tổng số reactions theo từng loại cho mỗi post
      const reactionCounts = await Reaction.findAll({
        where: {
          targetType: 'post',
          targetId: { [Op.in]: postIds }
        },
        attributes: [
          'targetId',
          'reactionType',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
        ],
        group: ['targetId', 'reactionType'],
        raw: true
      });

      console.log('Reaction counts from DB:', reactionCounts);

      // Lấy reaction của user hiện tại
      const userReactions = await Reaction.findAll({
        where: {
          userId: currentUserId,
          targetType: 'post',
          targetId: { [Op.in]: postIds }
        },
        attributes: ['targetId', 'reactionType'],
        raw: true
      });

      console.log('User reactions from DB:', userReactions);

      // Format dữ liệu reactions
      postsWithReactions = posts.map(post => {
        const postData = post.toJSON();
        
        // Tính tổng reactions theo từng loại
        const postReactionCounts = reactionCounts
          .filter(reaction => reaction.targetId === post.id)
          .reduce((acc, reaction) => {
            acc[reaction.reactionType] = parseInt(reaction.count);
            return acc;
          }, {
            like: 0,
            love: 0,
            wow: 0,
            laugh: 0,
            angry: 0,
            sad: 0
          });

        // Tổng tất cả reactions
        const totalReactions = Object.values(postReactionCounts).reduce((sum, count) => sum + count, 0);

        // Reaction của user hiện tại
        const userReaction = userReactions.find(reaction => reaction.targetId === post.id);
        const currentUserReaction = userReaction ? userReaction.reactionType : null;

        return {
          ...postData,
          reactionCounts: postReactionCounts,
          totalReactions,
          currentUserReaction
        };
      });
    } else {
      console.log('No user token, returning posts without reactions');
    }

    const totalPages = Math.ceil(count / limit);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Posts retrieved successfully',
      data: {
        posts: postsWithReactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalPosts: count,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    logger.error('Error getting posts:', error);
    console.error('Full error:', error);
    next(error);
  }
};
/**
 * @desc    Get post by ID
 * @route   GET /api/posts/:id
 * @access  Public
 */
const getPostById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const post = await Post.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        },
        {
          model: Creator,
          as: 'creator',
          attributes: ['id', 'stageName'],
          required: false
        },
        {
          model: Comment,
          as: 'comments',
          limit: 5,
          order: [['createdAt', 'DESC']],
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
            }
          ]
        }
      ]
    });

    if (!post) {
      throw new ApiError('Post not found', StatusCodes.NOT_FOUND);
    }

    // Check access permissions
    if (!post.isPublic && (!req.user || req.user.id !== post.userId)) {
      throw new ApiError('Access denied to private post', StatusCodes.FORBIDDEN);
    }

    if (post.isPremium && (!req.user || req.user.id !== post.userId)) {
      // Check if user has access to premium content (subscription logic here)
      throw new ApiError('Premium content access required', StatusCodes.PAYMENT_REQUIRED);
    }

    // Increment view count
    await post.increment('viewCount');

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Post retrieved successfully',
      data: post
    });

  } catch (error) {
    logger.error('Error getting post:', error);
    next(error);
  }
};

/**
 * @desc    Update post
 * @route   PUT /api/posts/:id
 * @access  Private (Owner only)
 */
const updatePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const post = await Post.findByPk(id);

    if (!post) {
      throw new ApiError('Post not found', StatusCodes.NOT_FOUND);
    }

    // Check ownership
    if (post.userId !== userId) {
      throw new ApiError('Not authorized to update this post', StatusCodes.FORBIDDEN);
    }

    const {
      content,
      mediaType,
      mediaUrls,
      thumbnailUrl,
      isPublic,
      isPremium,
      price,
      scheduledAt,
      tags,
      location,
      status
    } = req.body;

    // If making post premium, validate creator status
    if (isPremium && !post.isPremium) {
      const creator = await Creator.findOne({ where: { userId } });
      if (!creator) {
        throw new ApiError('Only creators can create premium posts', StatusCodes.FORBIDDEN);
      }
      post.creatorId = creator.id;
    }

    // Update fields
    if (content !== undefined) post.content = content;
    if (mediaType !== undefined) post.mediaType = mediaType;
    if (mediaUrls !== undefined) post.mediaUrls = mediaUrls;
    if (thumbnailUrl !== undefined) post.thumbnailUrl = thumbnailUrl;
    if (isPublic !== undefined) post.isPublic = isPublic;
    if (isPremium !== undefined) post.isPremium = isPremium;
    if (price !== undefined) post.price = price;
    if (scheduledAt !== undefined) post.scheduledAt = scheduledAt;
    if (tags !== undefined) post.tags = tags;
    if (location !== undefined) post.location = location;
    if (status !== undefined) post.status = status;

    await post.save();

    // Fetch updated post with associations
    const updatedPost = await Post.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        },
        {
          model: Creator,
          as: 'creator',
          attributes: ['id', 'stageName'],
          required: false
        }
      ]
    });

    logger.info(`Post ${id} updated by user ${userId}`);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Post updated successfully',
      data: updatedPost
    });

  } catch (error) {
    logger.error('Error updating post:', error);
    next(error);
  }
};

/**
 * @desc    Delete post
 * @route   DELETE /api/posts/:id
 * @access  Private (Owner only)
 */
const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const post = await Post.findByPk(id);

    if (!post) {
      throw new ApiError('Post not found', StatusCodes.NOT_FOUND);
    }

    // Check ownership or admin role
    if (post.userId !== userId && req.user.role !== 'admin') {
      throw new ApiError('Not authorized to delete this post', StatusCodes.FORBIDDEN);
    }

    // Soft delete by updating status
    post.status = 'deleted';
    await post.save();

    logger.info(`Post ${id} deleted by user ${userId}`);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Post deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting post:', error);
    next(error);
  }
};

/**
 * @desc    Get user's posts
 * @route   GET /api/posts/user/:userId
 * @access  Public
 */
const getUserPosts = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const {
      page = 1,
      limit = 10,
      status = 'published'
    } = req.query;

    const offset = (page - 1) * limit;

    const whereConditions = {
      userId,
      status
    };

    // If not the owner, only show public posts
    if (!req.user || req.user.id !== parseInt(userId)) {
      whereConditions.isPublic = true;
    }

    const { count, rows: posts } = await Post.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        },
        {
          model: Creator,
          as: 'creator',
          attributes: ['id', 'stageName'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    const totalPages = Math.ceil(count / limit);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'User posts retrieved successfully',
      data: {
        posts,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalPosts: count,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    logger.error('Error getting user posts:', error);
    next(error);
  }
};

/**
 * @desc    Get trending posts
 * @route   GET /api/posts/trending
 * @access  Public
 */
const getTrendingPosts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      timeframe = '7d' // 1d, 7d, 30d
    } = req.query;

    const offset = (page - 1) * limit;

    // Calculate date filter based on timeframe
    let dateFilter = new Date();
    switch (timeframe) {
      case '1d':
        dateFilter.setDate(dateFilter.getDate() - 1);
        break;
      case '30d':
        dateFilter.setDate(dateFilter.getDate() - 30);
        break;
      default: // 7d
        dateFilter.setDate(dateFilter.getDate() - 7);
    }

    const whereConditions = {
      status: 'published',
      isPublic: true,
      createdAt: {
        [Op.gte]: dateFilter
      }
    };

    // Calculate engagement score (likes + comments + shares)
    const posts = await Post.findAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        },
        {
          model: Creator,
          as: 'creator',
          attributes: ['id', 'stageName'],
          required: false
        }
      ],
      attributes: {
        include: [
          [
            Sequelize.literal('(likeCount + commentCount + shareCount)'),
            'engagementScore'
          ]
        ]
      },
      order: [
        [Sequelize.literal('engagementScore'), 'DESC'],
        ['createdAt', 'DESC']
      ],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Trending posts retrieved successfully',
      data: {
        posts,
        timeframe
      }
    });

  } catch (error) {
    logger.error('Error getting trending posts:', error);
    next(error);
  }
};

/**
 * @desc    Search posts
 * @route   GET /api/posts/search
 * @access  Public
 */
const searchPosts = async (req, res, next) => {
  try {
    const {
      q: query,
      page = 1,
      limit = 10,
      mediaType,
      tags
    } = req.query;

    if (!query) {
      throw new ApiError('Search query is required', StatusCodes.BAD_REQUEST);
    }

    const offset = (page - 1) * limit;

    const whereConditions = {
      status: 'published',
      isPublic: true,
      [Op.or]: [
        {
          content: {
            [Op.iLike]: `%${query}%`
          }
        },
        {
          tags: {
            [Op.overlap]: [query]
          }
        }
      ]
    };

    if (mediaType) whereConditions.mediaType = mediaType;
    
    if (tags) {
      const tagArray = tags.split(',');
      whereConditions.tags = {
        [Op.overlap]: tagArray
      };
    }

    const { count, rows: posts } = await Post.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        },
        {
          model: Creator,
          as: 'creator',
          attributes: ['id', 'stageName'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    const totalPages = Math.ceil(count / limit);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Posts search completed',
      data: {
        posts,
        query,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalPosts: count,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    logger.error('Error searching posts:', error);
    next(error);
  }
};

/**
 * @desc    Get feed posts (posts from followed creators and users)
 * @route   GET /api/posts/feed/followed
 * @access  Private
 */
const getFeedPosts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      mediaType,
      sortBy = 'createdAt',
      order = 'DESC'
    } = req.query;

    const userId = req.user.id;
    const offset = (page - 1) * limit;

    // Get followed creators
    const followedCreators = await Follow.findAll({
      where: { followerId: userId },
      attributes: ['creatorId']
    });
    console.log("các creator bạn đang follow là", followedCreators.map(follow => follow.creatorId));

    const followedCreatorIds = followedCreators.map(follow => follow.creatorId);
    
    // If user doesn't follow any creators, return empty feed
    if (followedCreatorIds.length === 0) {
      return res.status(StatusCodes.OK).json({
        success: true,
        message: 'Feed posts retrieved successfully',
        data: {
          posts: [],
          pagination: {
            currentPage: parseInt(page),
            totalPages: 0,
            totalPosts: 0,
            hasNext: false,
            hasPrev: false
          }
        }
      });
    }

    // Build where conditions for posts from followed creators
    const whereConditions = {
      creatorId: {
        [Op.in]: followedCreatorIds
      },
      status: 'published',
      isPublic: true
    };

    if (mediaType) whereConditions.mediaType = mediaType;

    const { count, rows: posts } = await Post.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        },
        {
          model: Creator,
          as: 'creator',
          attributes: ['id', 'stageName'],
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
      message: 'Feed posts retrieved successfully',
      data: {
        posts,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalPosts: count,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    logger.error('Error getting feed posts:', error);
    next(error);
  }
};

/**
 * @desc    Get posts from followed creators (premium content included if subscribed)
 * @route   GET /api/posts/feed/premium
 * @access  Private
 */
const getPremiumFeedPosts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      mediaType,
      sortBy = 'createdAt',
      order = 'DESC'
    } = req.query;

    const userId = req.user.id;
    const offset = (page - 1) * limit;

    // Get followed creators with subscription status
    const followedCreators = await Follow.findAll({
      where: { 
        followerId: userId,
        isSubscribed: true // Assuming there's a subscription field
      },
      attributes: ['creatorId']
    });

    const subscribedCreatorIds = followedCreators.map(follow => follow.creatorId);
    
    if (subscribedCreatorIds.length === 0) {
      return res.status(StatusCodes.OK).json({
        success: true,
        message: 'Premium feed posts retrieved successfully',
        data: {
          posts: [],
          pagination: {
            currentPage: parseInt(page),
            totalPages: 0,
            totalPosts: 0,
            hasNext: false,
            hasPrev: false
          }
        }
      });
    }

    // Build where conditions for premium posts from subscribed creators
    const whereConditions = {
      creatorId: {
        [Op.in]: subscribedCreatorIds
      },
      status: 'published',
      isPremium: true
    };

    if (mediaType) whereConditions.mediaType = mediaType;

    const { count, rows: posts } = await Post.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        },
        {
          model: Creator,
          as: 'creator',
          attributes: ['id', 'stageName'],
          required: true
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
      message: 'Premium feed posts retrieved successfully',
      data: {
        posts,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalPosts: count,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    logger.error('Error getting premium feed posts:', error);
    next(error);
  }
};

/**
 * @desc    Get creator's posts (for creator profile page)
 * @route   GET /api/posts/creator/:creatorId
 * @access  Public
 */
const getCreatorPosts = async (req, res, next) => {
  try {
    const { creatorId } = req.params;
    const {
      page = 1,
      limit = 10,
      status = 'published'
    } = req.query;

    const offset = (page - 1) * limit;

    const whereConditions = {
      creatorId,
      status
    };

    // If not authenticated or not the creator owner, only show public posts
    const creator = await Creator.findByPk(creatorId);
    if (!creator) {
      throw new ApiError('Creator not found', StatusCodes.NOT_FOUND);
    }

    if (!req.user || req.user.id !== creator.userId) {
      whereConditions.isPublic = true;
      // Only show free content for non-subscribers
      whereConditions.isPremium = false;
    }

    const { count, rows: posts } = await Post.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        },
        {
          model: Creator,
          as: 'creator',
          attributes: ['id', 'stageName'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    const totalPages = Math.ceil(count / limit);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Creator posts retrieved successfully',
      data: {
        posts,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalPosts: count,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    logger.error('Error getting creator posts:', error);
    next(error);
  }
};

module.exports = {
  createPost,
  getAllPosts,
  getPostById,
  updatePost,
  deletePost,
  getUserPosts,
  getTrendingPosts,
  searchPosts,
  getFeedPosts,
  getPremiumFeedPosts,
  getCreatorPosts
};