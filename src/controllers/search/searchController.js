const { User, Creator, Post } = require('../../models');
const { StatusCodes } = require('http-status-codes');
const { validationResult } = require('express-validator');
const { Op, fn, col, literal } = require('sequelize');

/**
 * Tính toán độ tương tự giữa hai chuỗi sử dụng Levenshtein distance
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} Độ tương tự từ 0 đến 1
 */
const calculateSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

/**
 * Tính toán Levenshtein distance
 */
const levenshteinDistance = (str1, str2) => {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

/**
 * Tạo điều kiện tìm kiếm thông minh
 * @param {string} query 
 * @param {Array} fields 
 * @returns {Object}
 */
const createSmartSearchCondition = (query, fields) => {
  const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
  const conditions = [];
  
  // Tìm kiếm chính xác
  fields.forEach(field => {
    conditions.push({
      [field]: {
        [Op.iLike]: `%${query}%`
      }
    });
  });
  
  // Tìm kiếm từng từ
  searchTerms.forEach(term => {
    fields.forEach(field => {
      conditions.push({
        [field]: {
          [Op.iLike]: `%${term}%`
        }
      });
    });
  });
  
  return {
    [Op.or]: conditions
  };
};

/**
 * Tính điểm relevance cho kết quả
 * @param {Object} item 
 * @param {string} query 
 * @param {Array} searchFields 
 * @returns {number}
 */
const calculateRelevanceScore = (item, query, searchFields) => {
  let maxScore = 0;
  const queryLower = query.toLowerCase();
  
  searchFields.forEach(field => {
    const fieldValue = item[field];
    if (!fieldValue) return;
    
    const fieldStr = Array.isArray(fieldValue) 
      ? fieldValue.join(' ').toLowerCase()
      : fieldValue.toString().toLowerCase();
    
    // Exact match gets highest score
    if (fieldStr === queryLower) {
      maxScore = Math.max(maxScore, 100);
      return;
    }
    
    // Contains full query
    if (fieldStr.includes(queryLower)) {
      maxScore = Math.max(maxScore, 90);
    }
    
    // Starts with query
    if (fieldStr.startsWith(queryLower)) {
      maxScore = Math.max(maxScore, 85);
    }
    
    // Similarity score
    const similarity = calculateSimilarity(fieldStr, queryLower);
    if (similarity > 0.7) {
      maxScore = Math.max(maxScore, similarity * 80);
    }
    
    // Word match score
    const queryWords = queryLower.split(/\s+/);
    const fieldWords = fieldStr.split(/\s+/);
    const matchingWords = queryWords.filter(qw => 
      fieldWords.some(fw => fw.includes(qw) || qw.includes(fw))
    );
    
    if (matchingWords.length > 0) {
      const wordMatchScore = (matchingWords.length / queryWords.length) * 70;
      maxScore = Math.max(maxScore, wordMatchScore);
    }
  });
  
  return maxScore;
};

/**
 * Tìm kiếm Users
 * @param {string} query 
 * @param {number} limit 
 * @returns {Array}
 */
const searchUsers = async (query, limit = 3) => {
  try {
    const searchCondition = createSmartSearchCondition(query, [
      'username', 'firstName', 'lastName', 'email'
    ]);
    
    const users = await User.findAll({
      where: {
        ...searchCondition,
        isActive: true
      },
      attributes: [
        'id', 'username', 'firstName', 'lastName', 
        'avatar', 'isOnline', 'createdAt'
      ],
      limit: limit * 2, // Lấy nhiều hơn để filter và sort
      order: [['createdAt', 'DESC']]
    });
    
    // Tính điểm relevance và sắp xếp
    const usersWithScore = users.map(user => {
      const score = calculateRelevanceScore(
        user.dataValues, 
        query, 
        ['username', 'firstName', 'lastName']
      );
      
      return {
        ...user.dataValues,
        relevanceScore: score,
        type: 'user',
        displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username
      };
    });
    
    return usersWithScore
      .filter(user => user.relevanceScore > 30) // Chỉ lấy kết quả có độ liên quan cao
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
      
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
};

/**
 * Tìm kiếm Creators
 * @param {string} query 
 * @param {number} limit 
 * @returns {Array}
 */
const searchCreators = async (query, limit = 3) => {
  try {
    // FIX: Chỉ định rõ bảng Creator cho tags và specialties
    const tagSearchCondition = literal(`
      EXISTS (
        SELECT 1 FROM json_array_elements_text("Creator"."tags") as tag 
        WHERE LOWER(tag) LIKE LOWER('%${query.replace(/'/g, "''")}%')
      ) OR EXISTS (
        SELECT 1 FROM json_array_elements_text("Creator"."specialties") as specialty 
        WHERE LOWER(specialty) LIKE LOWER('%${query.replace(/'/g, "''")}%')
      )
    `);
    
    const searchCondition = {
      [Op.or]: [
        createSmartSearchCondition(query, [
          'stageName', 'titleBio', 'bio', 'service'
        ]),
        tagSearchCondition
      ]
    };
    
    const creators = await Creator.findAll({
      where: searchCondition,
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'isOnline'],
        where: { isActive: true }
      }],
      attributes: [
        'id', 'userId', 'stageName', 'titleBio', 'bio', 
        'bioThumbnail', 'rating', 'totalRatings', 'isVerified', 
        'isLive', 'tags', 'specialties', 'createdAt'
      ],
      limit: limit * 2,
      order: [['rating', 'DESC'], ['totalRatings', 'DESC']]
    });
    
    // Filter creators theo tags/specialties ở JavaScript level  
    const filteredCreators = creators.filter(creator => {
      const tags = creator.tags || [];
      const specialties = creator.specialties || [];
      const allKeywords = [...tags, ...specialties];
      const queryLower = query.toLowerCase();
      
      // Check basic fields match (đã có từ basicSearchCondition)
      const basicMatch = creator.stageName?.toLowerCase().includes(queryLower) ||
                        creator.titleBio?.toLowerCase().includes(queryLower) ||
                        creator.bio?.toLowerCase().includes(queryLower) ||
                        creator.service?.toLowerCase().includes(queryLower);
      
      // Check tags/specialties match
      const keywordMatch = allKeywords.some(keyword => 
        keyword.toLowerCase().includes(queryLower) || 
        queryLower.includes(keyword.toLowerCase())
      );
      
      return basicMatch || keywordMatch;
    });
    
    // Tính điểm relevance
    const creatorsWithScore = filteredCreators.map(creator => {
      let score = calculateRelevanceScore(
        creator.dataValues, 
        query, 
        ['stageName', 'titleBio', 'bio', 'service']
      );
      
      // Bonus điểm cho tags và specialties match của Creator
      const tags = creator.tags || [];
      const specialties = creator.specialties || [];
      const allKeywords = [...tags, ...specialties];
      
      const queryLower = query.toLowerCase();
      const keywordMatch = allKeywords.some(keyword => 
        keyword.toLowerCase().includes(queryLower) || 
        queryLower.includes(keyword.toLowerCase())
      );
      
      if (keywordMatch) {
        score += 15;
      }
      
      // Bonus điểm cho creator được verified và có rating cao
      if (creator.isVerified) score += 5;
      if (creator.rating >= 4) score += 3;
      if (creator.isLive) score += 2;
      
      return {
        ...creator.dataValues,
        user: creator.user?.dataValues,
        relevanceScore: score,
        type: 'creator',
        displayName: creator.stageName
      };
    });
    
    return creatorsWithScore
      .filter(creator => creator.relevanceScore > 25)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
      
  } catch (error) {
    console.error('Error searching creators:', error);
    return [];
  }
};

/**
 * Tìm kiếm Posts
 * @param {string} query 
 * @param {number} limit 
 * @returns {Array}
 */
const searchPosts = async (query, limit = 3) => {
  try {
    // FIX: Chỉ định rõ bảng Post cho tags
    const tagSearchCondition = literal(`
      EXISTS (
        SELECT 1 FROM json_array_elements_text("Post"."tags") as tag 
        WHERE LOWER(tag) LIKE LOWER('%${query.replace(/'/g, "''")}%')
      )
    `);
    
    const searchCondition = {
      [Op.or]: [
        createSmartSearchCondition(query, ['content', 'location']),
        tagSearchCondition
      ]
    };
    
    const posts = await Post.findAll({
      where: {
        ...searchCondition,
        status: 'published',
        isPublic: true
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar'],
          where: { isActive: true }
        },
        {
          model: Creator,
          as: 'creator',
          attributes: ['id', 'stageName', 'isVerified'],
          required: false
        }
      ],
      attributes: [
        'id', 'userId', 'creatorId', 'content', 'mediaType', 
        'thumbnailUrl', 'viewCount', 'likeCount', 'commentCount', 
        'tags', 'location', 'createdAt'
      ],
      limit: limit * 2,
      order: [
        ['likeCount', 'DESC'], 
        ['viewCount', 'DESC'], 
        ['createdAt', 'DESC']
      ]
    });
    
    // Tính điểm relevance
    const postsWithScore = posts.map(post => {
      let score = calculateRelevanceScore(
        post.dataValues, 
        query, 
        ['content', 'location']
      );
      
      // Bonus điểm cho tags match
      const tags = post.tags || [];
      const queryLower = query.toLowerCase();
      const tagMatch = tags.some(tag => 
        tag.toLowerCase().includes(queryLower) || 
        queryLower.includes(tag.toLowerCase())
      );
      
      if (tagMatch) {
        score += 20;
      }
      
      // Bonus điểm dựa trên engagement
      const engagementScore = (post.likeCount * 2 + post.commentCount * 3 + post.viewCount * 0.1) / 100;
      score += Math.min(engagementScore, 10);
      
      // Bonus cho creator verified
      if (post.creator?.isVerified) score += 3;
      
      return {
        ...post.dataValues,
        user: post.user?.dataValues,
        creator: post.creator?.dataValues,
        relevanceScore: score,
        type: 'post',
        displayName: post.content?.substring(0, 100) + (post.content?.length > 100 ? '...' : '')
      };
    });
    
    return postsWithScore
      .filter(post => post.relevanceScore > 20)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
      
  } catch (error) {
    console.error('Error searching posts:', error);
    return [];
  }
};

/**
 * Search across Users, Creators, and Posts
 */
const searchAll = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }
    
    const { query, limit = 3 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Query must be at least 2 characters long'
      });
    }
    
    const searchQuery = query.trim();
    const searchLimit = Math.min(parseInt(limit) || 3, 10); // Max 10 results per type
    
    // Thực hiện tìm kiếm song song
    const [users, creators, posts] = await Promise.all([
      searchUsers(searchQuery, searchLimit),
      searchCreators(searchQuery, searchLimit),
      searchPosts(searchQuery, searchLimit)
    ]);
    
    // Tổng hợp kết quả
    const totalResults = users.length + creators.length + posts.length;
    
    // Tính toán overall relevance để suggest best matches
    const allResults = [...users, ...creators, ...posts]
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    const topResults = allResults.slice(0, 5); // Top 5 overall results
    
    return res.status(StatusCodes.OK).json({
      success: true,
      message: `Found ${totalResults} results for "${searchQuery}"`,
      data: {
        query: searchQuery,
        totalResults,
        results: {
          users: users.map(user => ({
            id: user.id,
            type: user.type,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar,
            isOnline: user.isOnline,
            relevanceScore: Math.round(user.relevanceScore)
          })),
          creators: creators.map(creator => ({
            id: creator.id,
            type: creator.type,
            stageName: creator.stageName,
            displayName: creator.displayName,
            bio: creator.titleBio || creator.bio?.substring(0, 100),
            bioThumbnail: creator.bioThumbnail,
            rating: creator.rating,
            totalRatings: creator.totalRatings,
            isVerified: creator.isVerified,
            isLive: creator.isLive,
            tags: creator.tags?.slice(0, 5), // Limit tags
            user: creator.user,
            relevanceScore: Math.round(creator.relevanceScore)
          })),
          posts: posts.map(post => ({
            id: post.id,
            type: post.type,
            content: post.displayName,
            mediaType: post.mediaType,
            thumbnailUrl: post.thumbnailUrl,
            likeCount: post.likeCount,
            commentCount: post.commentCount,
            viewCount: post.viewCount,
            tags: post.tags?.slice(0, 3), // Limit tags
            user: post.user,
            creator: post.creator,
            createdAt: post.createdAt,
            relevanceScore: Math.round(post.relevanceScore)
          }))
        },
        topResults: topResults.slice(0, 5).map(result => ({
          id: result.id,
          type: result.type,
          displayName: result.displayName,
          relevanceScore: Math.round(result.relevanceScore)
        })),
        suggestions: {
          hasUsers: users.length > 0,
          hasCreators: creators.length > 0,
          hasPosts: posts.length > 0,
          bestMatch: allResults.length > 0 ? {
            type: allResults[0].type,
            displayName: allResults[0].displayName,
            score: Math.round(allResults[0].relevanceScore)
          } : null
        }
      }
    });
    
  } catch (error) {
    console.error('Error in searchAll:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error occurred during search',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  searchAll,
  searchUsers,
  searchCreators,
  searchPosts,
  calculateSimilarity,
  calculateRelevanceScore
};