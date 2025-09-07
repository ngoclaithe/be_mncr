const { User, Creator, Follow } = require('../../models');
const { StatusCodes } = require('http-status-codes');
const { validationResult } = require('express-validator');

/**
 * @desc    Get a list of all creators
 * @route   GET /api/v1/creators
 * @access  Public
 */
const getCreators = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { page = 1, limit = 10, isVerified, isLive, sortBy = 'rating' } = req.query;
    const offset = (page - 1) * limit;

    // Build where conditions for Creator
    const creatorWhere = {};
    if (isVerified !== undefined) {
      creatorWhere.isVerified = isVerified === 'true';
    }
    if (isLive !== undefined) {
      creatorWhere.isLive = isLive === 'true';
    }

    // Define sort options
    let orderBy;
    switch (sortBy) {
      case 'rating':
        orderBy = [['rating', 'DESC']];
        break;
      case 'newest':
        orderBy = [['createdAt', 'DESC']];
        break;
      case 'earnings':
        orderBy = [['totalEarnings', 'DESC']];
        break;
      default:
        orderBy = [['rating', 'DESC']];
    }

    const { count, rows } = await Creator.findAndCountAll({
      where: creatorWhere,
      include: [
        {
          model: User,
          as: 'user',
          where: {
            role: 'creator',
            isActive: true,
          },
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'city']
        },
        {
          model: Follow,
          as: 'followers',
          attributes: []
        }
      ],
      attributes: [
        'id',
        'stageName',
        'bio',
        'tags',
        'rating',
        'totalRatings',
        'isVerified',
        'isLive',
        'hourlyRate',
        'bookingPrice',
        'subscriptionPrice',
        'specialties',
        'languages',
        'isAvailableForBooking',
        'createdAt',
        [require('sequelize').fn('COUNT', require('sequelize').col('followers.id')), 'followersCount']
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: orderBy,
      group: ['Creator.id', 'user.id'],
      distinct: true,
      subQuery: false
    });

    // Transform data to include userId at top level and followersCount
    const transformedRows = rows.map(creator => ({
      id: creator.id,
      userId: creator.user.id,
      stageName: creator.stageName,
      bio: creator.bio,
      tags: creator.tags,
      rating: creator.rating,
      totalRatings: creator.totalRatings,
      isVerified: creator.isVerified,
      isLive: creator.isLive,
      hourlyRate: creator.hourlyRate,
      bookingPrice: creator.bookingPrice,
      subscriptionPrice: creator.subscriptionPrice,
      specialties: creator.specialties,
      languages: creator.languages,
      isAvailableForBooking: creator.isAvailableForBooking,
      createdAt: creator.createdAt,
      followersCount: parseInt(creator.dataValues.followersCount) || 0,
      user: creator.user
    }));

    res.status(StatusCodes.OK).json({
      success: true,
      data: transformedRows,
      pagination: {
        total: count.length || count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil((count.length || count) / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single creator by ID
 * @route   GET /api/v1/creators/:id
 * @access  Public
 */
const getCreatorById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.id; // Lấy userId từ req.user nếu có

    const creator = await Creator.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'city', 'isOnline']
        },
        {
          model: Follow,
          as: 'followers',
          attributes: []
        }
      ],
      attributes: [
        'id',
        'userId',
        'stageName',
        'titleBio',
        'bio',
        'bioUrls',
        'tags',
        'rating',
        'totalRatings',
        'isVerified',
        'isLive',
        'hourlyRate',
        'minBookingDuration',
        'maxConcurrentBookings',
        'currentBookingsCount',
        'totalEarnings',
        'availabilitySchedule',
        'bookingPrice',
        'subscriptionPrice',
        'specialties',
        'languages',
        'bodyType',
        'height',
        'weight',
        'measurement',
        'eyeColor',
        'service',
        'isTatto',
        'signature',
        'hairColor',
        'cosmeticSurgery',
        'isAvailableForBooking',
        'createdAt',
        'updatedAt',
        [require('sequelize').fn('COUNT', require('sequelize').col('followers.id')), 'followersCount']
      ],
      group: ['Creator.id', 'user.id']
    });

    if (!creator) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Creator not found'
      });
    }

    // Kiểm tra xem user hiện tại đã follow creator này chưa (nếu có userId)
    let isFollowing = false;
    if (currentUserId) {
      const followRecord = await Follow.findOne({
        where: {
          followerId: currentUserId,
          creatorId: creator.id
        }
      });
      isFollowing = !!followRecord;
    }

    // Transform data to include userId at top level, followersCount và isFollowing
    const transformedCreator = {
      ...creator.toJSON(),
      userId: creator.user.id,
      followersCount: parseInt(creator.dataValues.followersCount) || 0,
      isFollowing // Thêm trường này vào response
    };

    res.status(StatusCodes.OK).json({
      success: true,
      data: transformedCreator
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get verified creators
 * @route   GET /api/v1/creators/verified
 * @access  Public
 */
const getVerifiedCreators = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await Creator.findAndCountAll({
      where: {
        isVerified: true
      },
      include: [{
        model: User,
        as: 'user',
        where: {
          role: 'creator',
          isActive: true,
        },
        attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'city']
      }],
      attributes: [
        'id',
        'stageName',
        'bio',
        'tags',
        'rating',
        'totalRatings',
        'isVerified',
        'specialties',
        'bookingPrice',
        'subscriptionPrice'
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['rating', 'DESC']],
      distinct: true
    });

    // Transform data to include userId at top level
    const transformedRows = rows.map(creator => ({
      id: creator.id,
      userId: creator.user.id,
      stageName: creator.stageName,
      bio: creator.bio,
      tags: creator.tags,
      rating: creator.rating,
      totalRatings: creator.totalRatings,
      isVerified: creator.isVerified,
      specialties: creator.specialties,
      bookingPrice: creator.bookingPrice,
      subscriptionPrice: creator.subscriptionPrice,
      user: creator.user
    }));

    res.status(StatusCodes.OK).json({
      success: true,
      data: transformedRows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get live creators
 * @route   GET /api/v1/creators/live
 * @access  Public
 */
const getLiveCreators = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await Creator.findAndCountAll({
      where: {
        isLive: true
      },
      include: [{
        model: User,
        as: 'user',
        where: {
          role: 'creator',
          isActive: true,
        },
        attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'city', 'isOnline']
      }],
      attributes: [
        'id',
        'stageName',
        'rating',
        'totalRatings',
        'isVerified',
        'tags',
        'specialties'
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['updatedAt', 'DESC']], 
      distinct: true
    });

    const transformedRows = rows.map(creator => ({
      id: creator.id,
      userId: creator.user.id,
      stageName: creator.stageName,
      rating: creator.rating,
      totalRatings: creator.totalRatings,
      isVerified: creator.isVerified,
      tags: creator.tags,
      specialties: creator.specialties,
      user: creator.user
    }));

    res.status(StatusCodes.OK).json({
      success: true,
      data: transformedRows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Search creators
 * @route   GET /api/v1/creators/search
 * @access  Public
 */
const searchCreators = async (req, res, next) => {
  try {
    const { q: query, page = 1, limit = 10, tags, minRating } = req.query;

    if (!query) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const offset = (page - 1) * limit;
    const { Op } = require('sequelize');

    // Build where conditions
    const creatorWhere = {
      [Op.or]: [
        {
          stageName: {
            [Op.iLike]: `%${query}%`
          }
        },
        {
          bio: {
            [Op.iLike]: `%${query}%`
          }
        }
      ]
    };

    // Add filters
    if (tags) {
      const tagArray = tags.split(',');
      creatorWhere.tags = {
        [Op.overlap]: tagArray
      };
    }

    if (minRating) {
      creatorWhere.rating = {
        [Op.gte]: parseFloat(minRating)
      };
    }

    const { count, rows } = await Creator.findAndCountAll({
      where: creatorWhere,
      include: [{
        model: User,
        as: 'user',
        where: {
          role: 'creator',
          isActive: true,
        },
        attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'city']
      }],
      attributes: [
        'id',
        'stageName',
        'bio',
        'tags',
        'rating',
        'totalRatings',
        'isVerified',
        'specialties',
        'bookingPrice',
        'subscriptionPrice'
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['rating', 'DESC']],
      distinct: true
    });

    const transformedRows = rows.map(creator => ({
      id: creator.id,
      userId: creator.user.id,
      stageName: creator.stageName,
      bio: creator.bio,
      tags: creator.tags,
      rating: creator.rating,
      totalRatings: creator.totalRatings,
      isVerified: creator.isVerified,
      specialties: creator.specialties,
      bookingPrice: creator.bookingPrice,
      subscriptionPrice: creator.subscriptionPrice,
      user: creator.user
    }));

    res.status(StatusCodes.OK).json({
      success: true,
      data: transformedRows,
      query,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get featured creators (top 10 most followed)
 * @route   GET /api/v1/creators/featured
 * @access  Public
 */
const getFeaturedCreators = async (req, res, next) => {
  try {
    const featuredCreators = await Creator.findAll({
      include: [
        {
          model: User,
          as: 'user',
          where: {
            role: 'creator',
            isActive: true,
          },
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'city']
        },
        {
          model: Follow,
          as: 'followers',
          attributes: []
        }
      ],
      attributes: [
        'id',
        'stageName',
        'bio',
        'tags',
        'rating',
        'totalRatings',
        'isVerified',
        'specialties',
        'bookingPrice',
        'subscriptionPrice',
        [require('sequelize').fn('COUNT', require('sequelize').col('followers.id')), 'followersCount']
      ],
      group: ['Creator.id', 'user.id'],
      order: [[require('sequelize').fn('COUNT', require('sequelize').col('followers.id')), 'DESC']],
      limit: 10,
      subQuery: false
    });

    const transformedRows = featuredCreators.map(creator => ({
      id: creator.id,
      userId: creator.user.id,
      stageName: creator.stageName,
      bio: creator.bio,
      tags: creator.tags,
      rating: creator.rating,
      totalRatings: creator.totalRatings,
      isVerified: creator.isVerified,
      specialties: creator.specialties,
      bookingPrice: creator.bookingPrice,
      subscriptionPrice: creator.subscriptionPrice,
      followersCount: parseInt(creator.dataValues.followersCount) || 0,
      user: creator.user
    }));

    res.status(StatusCodes.OK).json({
      success: true,
      data: transformedRows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get callgirl creators
 * @route   GET /api/v1/creators/callgirls
 * @access  Public
 */
const getCallgirlCreators = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      city, 
      minPrice, 
      maxPrice, 
      sortBy = 'rating',
      isVerified,
      isAvailable
    } = req.query;
    
    const offset = (page - 1) * limit;
    const { Op } = require('sequelize');

    // Build where conditions cho User (city filter)
    const userWhere = {
      role: 'creator',
      isActive: true
    };

    if (city) {
      userWhere.city = {
        [Op.iLike]: `%${city}%`
      };
    }

    // Build where conditions cho Creator - dùng raw query để tránh lỗi JSON
    let creatorWhereClause = `"Creator"."specialties"::text LIKE '%"callgirl"%'`;
    const replacements = {};
    let paramIndex = 1;

    // Filter theo booking price
    if (minPrice) {
      creatorWhereClause += ` AND "Creator"."bookingPrice" >= :minPrice${paramIndex}`;
      replacements[`minPrice${paramIndex}`] = parseFloat(minPrice);
      paramIndex++;
    }
    
    if (maxPrice) {
      creatorWhereClause += ` AND "Creator"."bookingPrice" <= :maxPrice${paramIndex}`;
      replacements[`maxPrice${paramIndex}`] = parseFloat(maxPrice);
      paramIndex++;
    }

    // Filter theo verified status
    if (isVerified !== undefined) {
      creatorWhereClause += ` AND "Creator"."isVerified" = :isVerified${paramIndex}`;
      replacements[`isVerified${paramIndex}`] = isVerified === 'true';
      paramIndex++;
    }

    // Filter theo availability
    if (isAvailable !== undefined) {
      creatorWhereClause += ` AND "Creator"."isAvailableForBooking" = :isAvailable${paramIndex}`;
      replacements[`isAvailable${paramIndex}`] = isAvailable === 'true';
      paramIndex++;
    }

    // Define sort options
    let orderBy;
    switch (sortBy) {
      case 'rating':
        orderBy = [['rating', 'DESC']];
        break;
      case 'price_low':
        orderBy = [['bookingPrice', 'ASC']];
        break;
      case 'price_high':
        orderBy = [['bookingPrice', 'DESC']];
        break;
      case 'newest':
        orderBy = [['createdAt', 'DESC']];
        break;
      case 'followers':
        orderBy = [[require('sequelize').fn('COUNT', require('sequelize').col('followers.id')), 'DESC']];
        break;
      default:
        orderBy = [['rating', 'DESC']];
    }

    const { count, rows } = await Creator.findAndCountAll({
      where: require('sequelize').literal(creatorWhereClause),
      replacements: replacements,
      include: [
        {
          model: User,
          as: 'user',
          where: userWhere,
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'city', 'isOnline']
        },
        {
          model: Follow,
          as: 'followers',
          attributes: []
        }
      ],
      attributes: [
        'id',
        'stageName',
        'bio',
        'tags',
        'rating',
        'totalRatings',
        'isVerified',
        'isLive',
        'bookingPrice',
        'subscriptionPrice',
        'specialties',
        'languages',
        'bodyType',
        'height',
        'weight',
        'eyeColor',
        'hairColor',
        'isAvailableForBooking',
        'service',
        'createdAt',
        [require('sequelize').fn('COUNT', require('sequelize').col('followers.id')), 'followersCount']
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: orderBy,
      group: ['Creator.id', 'user.id'],
      distinct: true,
      subQuery: false
    });

    // Transform data
    const transformedRows = rows.map(creator => ({
      id: creator.id,
      userId: creator.user.id,
      stageName: creator.stageName,
      bio: creator.bio,
      tags: creator.tags,
      rating: creator.rating,
      totalRatings: creator.totalRatings,
      isVerified: creator.isVerified,
      isLive: creator.isLive,
      bookingPrice: creator.bookingPrice,
      subscriptionPrice: creator.subscriptionPrice,
      specialties: creator.specialties,
      languages: creator.languages,
      bodyType: creator.bodyType,
      height: creator.height,
      weight: creator.weight,
      eyeColor: creator.eyeColor,
      hairColor: creator.hairColor,
      isAvailableForBooking: creator.isAvailableForBooking,
      service: creator.service,
      createdAt: creator.createdAt,
      followersCount: parseInt(creator.dataValues.followersCount) || 0,
      user: creator.user
    }));

    res.status(StatusCodes.OK).json({
      success: true,
      data: transformedRows,
      pagination: {
        total: count.length || count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil((count.length || count) / limit),
      },
      filters: {
        city,
        minPrice,
        maxPrice,
        sortBy,
        isVerified,
        isAvailable
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCreators,
  getCreatorById,
  getVerifiedCreators,
  getLiveCreators,
  searchCreators,
  getFeaturedCreators,
  getCallgirlCreators
};