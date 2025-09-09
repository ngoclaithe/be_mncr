const { User, Creator, Follow, sequelize } = require('../../models');
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
        'placeOfOperation',
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
      user: creator.user,
      placeOfOperation: creator.placeOfOperation
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
    const currentUser = req.user; // Lấy user object từ req.user
    const currentUserId = currentUser?.id;
    const isAdmin = currentUser?.role === 'admin';

    // Xác định attributes cho User dựa trên role
    const userAttributes = isAdmin 
      ? ['id', 'username', 'firstName', 'lastName', 'avatar', 'city', 'isOnline', 'email', 'phoneNumber', 'dateOfBirth', 'gender', 'country', 'timezone', 'language', 'tokens', 'totalSpent', 'affiliateCode', 'referredBy', 'isActive', 'isEmailVerified', 'lastLogin', 'registrationDate', 'createdAt', 'updatedAt']
      : ['id', 'username', 'firstName', 'lastName', 'avatar', 'city', 'isOnline'];

    const creator = await Creator.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: userAttributes
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
        'placeOfOperation',
        'telegram',
        'instagram',
        'facebook',
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

    // Transform data to include userId at top level, followersCount
    const transformedCreator = {
      ...creator.toJSON(),
      userId: creator.user.id,
      followersCount: parseInt(creator.dataValues.followersCount) || 0
    };

    // Chỉ kiểm tra isFollowing nếu không phải admin và có currentUserId
    if (!isAdmin && currentUserId) {
      const followRecord = await Follow.findOne({
        where: {
          followerId: currentUserId,
          creatorId: creator.id
        }
      });
      transformedCreator.isFollowing = !!followRecord;
    }

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
        'subscriptionPrice',
        'placeOfOperation'
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
      user: creator.user,
      placeOfOperation: creator.placeOfOperation
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
      user: creator.user,
      placeOfOperation: creator.placeOfOperation
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
        'subscriptionPrice',
        'placeOfOperation'
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
      user: creator.user,
      placeOfOperation: creator.placeOfOperation
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
        'placeOfOperation',
        'telegram',
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
      user: creator.user,
      placeOfOperation: creator.placeOfOperation,
      telegram: creator.telegram
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

/**
 * @desc    Update creator information
 * @route   PUT /api/v1/creators/:id
 * @access  Private (Creator/Admin)
 */
const updateCreator = async (req, res, next) => {
  
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    console.log('Validation errors:', JSON.stringify(errors.array(), null, 2));
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { id } = req.params;
    const currentUser = req.user;
    const isAdmin = currentUser?.role === 'admin';

    console.log('Creator ID:', id);
    console.log('Is Admin:', isAdmin);

    // Tìm creator cần update
    const creator = await Creator.findByPk(id, {
      include: [{
        model: User,
        as: 'user'
      }]
    });


    if (creator) {
      console.log('Creator ID:', creator.id);
    }

    if (!creator) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Creator not found'
      });
    }

    if (!isAdmin && currentUser.id !== creator.userId) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Not authorized to update this creator'
      });
    }

    // Tách data cho User và Creator
    const {
      // User fields,
      email,
      username,
      firstName,
      lastName,
      avatar,
      city,
      phoneNumber,
      dateOfBirth,
      gender,
      country,
      timezone,
      language,
      referralCode,
      // Creator fields
      stageName,
      titleBio,
      bio,
      bioUrls,
      tags,
      hourlyRate,
      minBookingDuration,
      maxConcurrentBookings,
      availabilitySchedule,
      bookingPrice,
      subscriptionPrice,
      specialties,
      languages: creatorLanguages,
      bodyType,
      height,
      weight,
      measurement,
      eyeColor,
      service,
      isTatto,
      signature,
      hairColor,
      cosmeticSurgery,
      isAvailableForBooking,
      placeOfOperation,
      telegram,
      instagram,
      facebook,
      
      // Admin only fields
      isVerified,
      isLive,
      totalEarnings,
      rating,
      totalRatings
    } = req.body;

    // Prepare update data for User
    const userUpdateData = {};
    if (firstName !== undefined) userUpdateData.firstName = firstName;
    if (lastName !== undefined) userUpdateData.lastName = lastName;
    if (avatar !== undefined) userUpdateData.avatar = avatar;
    if (city !== undefined) userUpdateData.city = city;
    if (phoneNumber !== undefined) userUpdateData.phoneNumber = phoneNumber;
    if (dateOfBirth !== undefined) userUpdateData.dateOfBirth = dateOfBirth;
    if (gender !== undefined) userUpdateData.gender = gender;
    if (country !== undefined) userUpdateData.country = country;
    if (timezone !== undefined) userUpdateData.timezone = timezone;
    if (language !== undefined) userUpdateData.language = language;

    console.log('User update data:', JSON.stringify(userUpdateData, null, 2));

    // Prepare update data for Creator
    const creatorUpdateData = {};
    if (stageName !== undefined) creatorUpdateData.stageName = stageName;
    if (titleBio !== undefined) creatorUpdateData.titleBio = titleBio;
    if (bio !== undefined) creatorUpdateData.bio = bio;
    if (bioUrls !== undefined) creatorUpdateData.bioUrls = bioUrls;
    if (tags !== undefined) creatorUpdateData.tags = tags;
    if (hourlyRate !== undefined) creatorUpdateData.hourlyRate = hourlyRate;
    if (minBookingDuration !== undefined) creatorUpdateData.minBookingDuration = minBookingDuration;
    if (maxConcurrentBookings !== undefined) creatorUpdateData.maxConcurrentBookings = maxConcurrentBookings;
    if (availabilitySchedule !== undefined) creatorUpdateData.availabilitySchedule = availabilitySchedule;
    if (bookingPrice !== undefined) creatorUpdateData.bookingPrice = bookingPrice;
    if (subscriptionPrice !== undefined) creatorUpdateData.subscriptionPrice = subscriptionPrice;
    if (specialties !== undefined) creatorUpdateData.specialties = specialties;
    if (creatorLanguages !== undefined) creatorUpdateData.languages = creatorLanguages;
    if (bodyType !== undefined) creatorUpdateData.bodyType = bodyType;
    if (height !== undefined) creatorUpdateData.height = height;
    if (weight !== undefined) creatorUpdateData.weight = weight;
    if (measurement !== undefined) creatorUpdateData.measurement = measurement;
    if (eyeColor !== undefined) creatorUpdateData.eyeColor = eyeColor;
    if (service !== undefined) {
      creatorUpdateData.service = Array.isArray(service) ? service.join(' ') : service;
    } if (isTatto !== undefined) creatorUpdateData.isTatto = isTatto;
    if (signature !== undefined) creatorUpdateData.signature = signature;
    if (hairColor !== undefined) creatorUpdateData.hairColor = hairColor;
    if (cosmeticSurgery !== undefined) creatorUpdateData.cosmeticSurgery = cosmeticSurgery;
    if (isAvailableForBooking !== undefined) creatorUpdateData.isAvailableForBooking = isAvailableForBooking;
    // if (placeOfOperation !== undefined) creatorUpdateData.placeOfOperation = placeOfOperation;
    if (placeOfOperation !== undefined) {
      if (typeof placeOfOperation === 'object' && placeOfOperation !== null) {
        creatorUpdateData.placeOfOperation = {
          ...creator.placeOfOperation, 
          ...placeOfOperation         
        };
      } else {
        creatorUpdateData.placeOfOperation = placeOfOperation;
      }
    }
    if (telegram !== undefined) creatorUpdateData.telegram = telegram;
    if (instagram !== undefined) creatorUpdateData.instagram = instagram;
    if (facebook !== undefined) creatorUpdateData.facebook = facebook;

    // Admin only fields
    if (isAdmin) {
      if (isVerified !== undefined) creatorUpdateData.isVerified = isVerified;
      if (isLive !== undefined) creatorUpdateData.isLive = isLive;
      if (totalEarnings !== undefined) creatorUpdateData.totalEarnings = totalEarnings;
      if (rating !== undefined) creatorUpdateData.rating = rating;
      if (totalRatings !== undefined) creatorUpdateData.totalRatings = totalRatings;
    }

    // Sử dụng transaction để đảm bảo data consistency
    const result = await sequelize.transaction(async (t) => {
      
      // Update User nếu có data
      if (Object.keys(userUpdateData).length > 0) {
        
        await User.update(userUpdateData, {
          where: { id: creator.userId },
          transaction: t
        });
      } else {
        console.log('=== 17. SKIPPING USER UPDATE (no data) ===');
      }

      // Update Creator nếu có data
      if (Object.keys(creatorUpdateData).length > 0) {       
        await Creator.update(creatorUpdateData, {
          where: { id: creator.id },
          transaction: t
        });
      } else {
        console.log('=== 19. SKIPPING CREATOR UPDATE (no data) ===');
      }      
      // Lấy updated data
      const updatedCreator = await Creator.findByPk(id, {
        include: [{
          model: User,
          as: 'user',
          attributes: isAdmin 
            ? ['id', 'username', 'firstName', 'lastName', 'avatar', 'city', 'isOnline', 'email', 'phoneNumber', 'dateOfBirth', 'gender', 'country', 'timezone', 'language', 'createdAt', 'updatedAt']
            : ['id', 'username', 'firstName', 'lastName', 'avatar', 'city', 'isOnline']
        }],
        transaction: t
      });

      return updatedCreator;
    });

    // Transform response data
    const transformedCreator = {
      ...result.toJSON(),
      userId: result.user.id
    };

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Creator updated successfully',
      data: transformedCreator
    });

  } catch (error) {
    
    // Xử lý specific errors
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Username or email already exists'
      });
    }
    
    if (error.name === 'SequelizeValidationError') {
      console.log('Validation errors:', error.errors);
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Validation error',
        errors: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    next(error);
  }
};

const getRelatedCreators = async (req, res, next) => {
 try {
   const { id } = req.params;
   const { Op } = require('sequelize');

   // Tìm creator hiện tại với thông tin user để lấy city
   const currentCreator = await Creator.findByPk(id, {
     include: [{
       model: User,
       as: 'user',
       attributes: ['city']
     }]
   });

   if (!currentCreator) {
     return res.status(StatusCodes.NOT_FOUND).json({
       success: false,
       message: 'Creator not found'
     });
   }

   const currentPlaceOfOperation = currentCreator.placeOfOperation;
   const currentUserCity = currentCreator.user.city;

   let relatedCreators;
   let searchCriteria;
   let searchLocation;

   // Kiểm tra nếu placeOfOperation có dữ liệu (province hoặc district không null)
   const hasPlaceOfOperation = currentPlaceOfOperation && 
     (currentPlaceOfOperation.province || currentPlaceOfOperation.district);

   if (hasPlaceOfOperation) {
     // Tìm theo placeOfOperation
     const whereConditions = {
       id: {
         [Op.ne]: id // Loại trừ creator hiện tại
       }
     };

     // Tạo điều kiện tìm kiếm dựa trên province và district
     const placeConditions = [];
     
     if (currentPlaceOfOperation.province) {
       placeConditions.push({
         'placeOfOperation.province': currentPlaceOfOperation.province
       });
     }
     
     if (currentPlaceOfOperation.district) {
       placeConditions.push({
         'placeOfOperation.district': currentPlaceOfOperation.district
       });
     }

     // Ưu tiên tìm creators có cùng cả province và district
     relatedCreators = await Creator.findAll({
       where: {
         ...whereConditions,
         [Op.and]: placeConditions.map(condition => 
           require('sequelize').literal(
             Object.keys(condition).map(key => 
               `"Creator"."placeOfOperation"->>'${key.split('.')[1]}' = '${condition[key]}'`
             ).join(' AND ')
           )
         )
       },
       include: [{
         model: User,
         as: 'user',
         where: {
           role: 'creator',
           isActive: true
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
         'isLive',
         'bookingPrice',
         'subscriptionPrice',
         'specialties',
         'languages',
         'isAvailableForBooking',
         'createdAt',
         'placeOfOperation'
       ],
       order: [['rating', 'DESC']],
       limit: 10
     });

     searchCriteria = 'placeOfOperation';
     searchLocation = currentPlaceOfOperation;
   } 
   // Nếu placeOfOperation null hoặc rỗng, tìm theo city của user
   else if (currentUserCity) {
     relatedCreators = await Creator.findAll({
       where: {
         id: {
           [Op.ne]: id // Loại trừ creator hiện tại
         }
       },
       include: [{
         model: User,
         as: 'user',
         where: {
           role: 'creator',
           isActive: true,
           city: currentUserCity
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
         'isLive',
         'bookingPrice',
         'subscriptionPrice',
         'specialties',
         'languages',
         'isAvailableForBooking',
         'createdAt',
         'placeOfOperation'
       ],
       order: [['rating', 'DESC']],
       limit: 10
     });

     searchCriteria = 'city';
     searchLocation = currentUserCity;
   } 
   // Nếu cả placeOfOperation và city đều null, trả về mảng rỗng
   else {
     relatedCreators = [];
     searchCriteria = 'none';
     searchLocation = null;
   }

   // Transform data để include userId ở top level
   const transformedRows = relatedCreators.map(creator => ({
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
     isAvailableForBooking: creator.isAvailableForBooking,
     createdAt: creator.createdAt,
     placeOfOperation: creator.placeOfOperation,
     user: creator.user
   }));

   res.status(StatusCodes.OK).json({
     success: true,
     data: transformedRows,
     criteria: searchCriteria,
     location: searchLocation,
     total: transformedRows.length
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
  getCallgirlCreators,
  updateCreator,
  getRelatedCreators
};