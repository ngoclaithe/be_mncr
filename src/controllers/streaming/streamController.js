const { Stream, Creator, User } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const { validationResult } = require('express-validator');
const logger = require('../../utils/logger');
const crypto = require('crypto');

class StreamController {
  generateStreamKey = () => {
    return crypto.randomBytes(16).toString('hex');
  }

  validateStreamKey = (streamKey) => {
    const streamKeyRegex = /^[a-f0-9]{32}$/;
    return streamKeyRegex.test(streamKey);
  }

  startStream = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ success: false, errors: errors.array() });
    }

    try {
      const { 
        title, 
        description, 
        category, 
        tags, 
        quality = 'HD',
        isPrivate = false,
        chatEnabled = true,
        donationsEnabled = true,
        pricePerMinute,
        thumbnail
      } = req.body;
      
      const userId = req.user.id;

      const creator = await Creator.findOne({ where: { userId } });
      if (!creator) {
        return next(new ApiError('Only creators can start a stream.', StatusCodes.FORBIDDEN));
      }

      // Kiểm tra xem creator có stream đang live không
      const activeStream = await Stream.findOne({
        where: { creatorId: creator.id, isLive: true },
      });
      if (activeStream) {
        return next(new ApiError('You already have an active stream.', StatusCodes.CONFLICT));
      }

      // Generate unique stream key
      const streamKey = this.generateStreamKey();
      
      const stream = await Stream.create({
        title,
        description,
        creatorId: creator.id,
        category,
        tags: tags || [],
        quality,
        isPrivate,
        isLive: false, 
        chatEnabled,
        donationsEnabled,
        pricePerMinute,
        streamKey,
        viewerCount: 0,
        maxViewers: 0,
        totalDonations: 0.0,
        thumbnail
      });

      logger.info(`Stream session ${stream.id} created by creator ${creator.id} with key "${stream.streamKey}"`);

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: 'Stream session created successfully. Connect via WebSocket to start streaming.',
        data: {
          streamId: stream.id,
          streamKey: stream.streamKey,
          socketEndpoint: `/stream/${stream.streamKey}`,
        },
      });
    } catch (error) {
      logger.error(`Error creating stream session: ${error.message}`);
      next(error);
    }
  }

  stopStream = async (req, res, next) => {
    try {
      const { streamKey } = req.params;
      const userId = req.user.id;

      logger.info(`Stop stream request - streamKey: ${streamKey}, userId: ${userId}`);

      const stream = await Stream.findOne({
        where: { streamKey: streamKey },
        include: [{
          model: Creator,
          as: 'creator',
          where: { userId: userId },
          required: true
        }]
      });

      if (!stream) {
        logger.warn(`Stream not found or user not authorized - streamKey: ${streamKey}, userId: ${userId}`);
        return next(new ApiError('Stream not found or you do not have permission to stop it.', StatusCodes.NOT_FOUND));
      }

      logger.info(`Found stream ${stream.id}, isLive: ${stream.isLive}`);

      const duration = stream.startTime ? 
        Math.floor((new Date() - stream.startTime) / 1000) : 0;

      const updateData = { 
        isLive: false, 
        endTime: new Date(),
      };

      if (stream.startTime && duration > 0) {
        updateData.duration = duration;
      }

      await stream.update(updateData);

      logger.info(`Stream ${stream.id} stopped successfully. Duration: ${duration}s`);
      
      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Stream ended successfully.',
        data: {
          streamId: stream.id,
          title: stream.title,
          isLive: stream.isLive,
          duration: duration,
          maxViewers: stream.maxViewers,
          totalDonations: stream.totalDonations,
          endTime: stream.endTime
        }
      });
    } catch (error) {
      logger.error(`Error stopping stream: ${error.message}`, error);
      next(error);
    }
  }

  // Method để handle khi stream bắt đầu (được gọi từ socket handler)
  handleStreamStart = async (streamKey) => {
    try {
      if (!this.validateStreamKey(streamKey)) {
        logger.warn(`Invalid stream key format: ${streamKey}`);
        return false;
      }

      const stream = await Stream.findOne({
        where: { streamKey: streamKey, isLive: false }
      });

      if (!stream) {
        logger.warn(`Stream not found or already live: ${streamKey}`);
        return false;
      }

      // Update stream status to live và tạo HLS URL
      const hlsUrl = `/hls/${streamKey}/playlist.m3u8`;
      
      await stream.update({ 
        isLive: true,
        startTime: new Date(),
        hlsUrl: hlsUrl,
        viewerCount: 0,
        maxViewers: 0
      });

      logger.info(`Stream ${stream.id} went live with key ${streamKey}, HLS URL: ${hlsUrl}`);
      return true;
      
    } catch (error) {
      logger.error(`Error handling stream start: ${error.message}`);
      return false;
    }
  }

  // Method để handle khi stream kết thúc (được gọi từ socket handler)
  handleStreamEnd = async (streamKey) => {
    try {
      const stream = await Stream.findOne({
        where: { streamKey: streamKey, isLive: true }
      });

      if (stream) {
        const duration = stream.startTime ? 
          Math.floor((new Date() - stream.startTime) / 1000) : 0;
          
        await stream.update({ 
          isLive: false,
          endTime: new Date(),
          duration: duration
        });
        
        logger.info(`Stream ${stream.id} ended automatically. Duration: ${duration}s`);
        return true;
      }
      
      return false;
      
    } catch (error) {
      logger.error(`Error handling stream end: ${error.message}`);
      return false;
    }
  }

  getStreamInfo = async (req, res, next) => {
    try {
      const { streamId } = req.params; 
      
      const streamData = await Stream.findByPk(streamId, {
        include: [
          {
            model: Creator,
            as: 'creator',
            include: [{
              model: User,
              as: 'user',
              attributes: ['firstName', 'lastName', 'username', 'avatar']
            }]
          }
        ]
      });

      if (!streamData) {
        return next(new ApiError('Stream not found.', StatusCodes.NOT_FOUND));
      }

      // Format the response to create displayName
      const stream = streamData.get({ plain: true });
      const user = stream.creator?.user;
      if (user) {
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
        stream.creator.displayName = fullName || user.username;
        stream.creator.avatar = user.avatar;
        delete stream.creator.user; // Clean up nested user object
      }

      // Tính duration nếu stream đang live
      const duration = stream.isLive && stream.startTime
        ? Math.floor((new Date() - stream.startTime) / 1000)
        : stream.duration;

      // Generate HLS URL nếu stream đang live và chưa có hlsUrl
      let hlsUrl = stream.hlsUrl;
      if (stream.isLive && !hlsUrl && stream.streamKey) {
        hlsUrl = `/hls/${stream.streamKey}/playlist.m3u8`;
      }

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          streamId: stream.id,
          title: stream.title,
          description: stream.description,
          category: stream.category,
          tags: stream.tags,
          quality: stream.quality,
          isLive: stream.isLive,
          isPrivate: stream.isPrivate,
          creator: stream.creator,
          hlsUrl: hlsUrl,
          streamKey: stream.streamKey, // Include streamKey for HLS consistency
          startTime: stream.startTime,
          endTime: stream.endTime,
          duration: duration,
          viewerCount: stream.viewerCount || 0,
          maxViewers: stream.maxViewers || 0,
          chatEnabled: stream.chatEnabled,
          donationsEnabled: stream.donationsEnabled,
          pricePerMinute: stream.pricePerMinute,
          totalDonations: stream.totalDonations,
          thumbnail: stream.thumbnail
        }
      });
      
    } catch (error) {
      logger.error(`Error getting stream info: ${error.message}`);
      next(error);
    }
  }

  updateViewerCount = async (req, res, next) => {
    try {
      const { streamId } = req.params;
      const { viewerCount } = req.body;
      
      if (!viewerCount || isNaN(viewerCount) || viewerCount < 0) {
        return next(new ApiError('Invalid viewer count.', StatusCodes.BAD_REQUEST));
      }
      
      const stream = await Stream.findByPk(streamId);
      if (!stream) {
        return next(new ApiError('Stream not found.', StatusCodes.NOT_FOUND));
      }

      const currentMaxViewers = stream.maxViewers || 0;
      const newMaxViewers = Math.max(currentMaxViewers, parseInt(viewerCount));

      await stream.update({ 
        viewerCount: parseInt(viewerCount),
        maxViewers: newMaxViewers
      });

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          streamId: stream.id,
          viewerCount: stream.viewerCount,
          maxViewers: stream.maxViewers
        }
      });
      
    } catch (error) {
      logger.error(`Error updating viewer count: ${error.message}`);
      next(error);
    }
  }

  updateDonations = async (req, res, next) => {
    try {
      const { streamId } = req.params;
      const { amount } = req.body;
      
      if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        return next(new ApiError('Invalid donation amount.', StatusCodes.BAD_REQUEST));
      }
      
      const stream = await Stream.findByPk(streamId);
      if (!stream) {
        return next(new ApiError('Stream not found.', StatusCodes.NOT_FOUND));
      }

      if (!stream.donationsEnabled) {
        return next(new ApiError('Donations are not enabled for this stream.', StatusCodes.BAD_REQUEST));
      }

      const donationAmount = parseFloat(amount);
      const newTotal = parseFloat(stream.totalDonations || 0) + donationAmount;
      await stream.update({ totalDonations: newTotal });

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          streamId: stream.id,
          donationAmount: donationAmount,
          totalDonations: stream.totalDonations
        }
      });
      
    } catch (error) {
      logger.error(`Error updating donations: ${error.message}`);
      next(error);
    }
  }

  getLiveStreams = async (req, res, next) => {
    try {
      // Lấy parameters từ query với default values
      const { 
        limit = 20, 
        offset = 0, 
        category 
      } = req.query;
      
      // Xây dựng where clause
      const whereClause = { 
        isLive: true,
        isPrivate: false 
      };
      
      // Thêm filter category nếu có
      if (category) {
        whereClause.category = category;
      }
      
      // Thực hiện query với pagination
      const { count, rows: streams } = await Stream.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Creator,
            as: 'creator',
            include: [{
              model: User,
              as: 'user',
              attributes: ['firstName', 'lastName', 'username', 'avatar']
            }]
          }
        ],
        order: [['viewerCount', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Format dữ liệu để tạo displayName cho creator của mỗi stream
      const formattedStreams = streams.map(stream => {
        const plainStream = stream.get({ plain: true });
        const user = plainStream.creator?.user;

        if (user) {
          const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
          plainStream.creator.displayName = fullName || user.username;
          plainStream.creator.avatar = user.avatar;
          delete plainStream.creator.user; // Xóa nested user object
        }

        // Ensure HLS URL is available for live streams
        if (plainStream.isLive && !plainStream.hlsUrl && plainStream.streamKey) {
          plainStream.hlsUrl = `/hls/${plainStream.streamKey}/playlist.m3u8`;
        }

        return plainStream;
      });

      // Tính toán pagination info
      const totalPages = Math.ceil(count / parseInt(limit));
      const currentPage = Math.floor(parseInt(offset) / parseInt(limit)) + 1;
      const hasNextPage = currentPage < totalPages;
      const hasPrevPage = currentPage > 1;

      res.status(StatusCodes.OK).json({
        success: true,
        message: `Found ${count} live streams${category ? ` in category '${category}'` : ''}`,
        data: {
          streams: formattedStreams,
          pagination: {
            total: count,
            totalPages,
            currentPage,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasNextPage,
            hasPrevPage
          }
        }
      });
      
    } catch (error) {
      logger.error(`Error getting live streams: ${error.message}`, {
        query: req.query,
        stack: error.stack
      });
      next(error);
    }
  }
  
  // Method để validate stream key từ socket connection
  validateStreamConnection = async (streamKey) => {
    try {
      if (!this.validateStreamKey(streamKey)) {
        return { valid: false, message: 'Invalid stream key format' };
      }

      const streamData = await Stream.findOne({
        where: { streamKey: streamKey },
        include: [{
          model: Creator,
          as: 'creator',
          include: [{
            model: User,
            as: 'user',
            attributes: ['firstName', 'lastName', 'username']
          }]
        }]
      });

      if (!streamData) {
        return { valid: false, message: 'Stream not found' };
      }

      const stream = streamData.get({ plain: true });

      if (stream.isLive) {
        return { valid: false, message: 'Stream already live' };
      }

      // Format creator info
      const user = stream.creator?.user;
      if (user) {
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
        stream.creator.displayName = fullName || user.username;
        delete stream.creator.user;
      }

      return { 
        valid: true, 
        stream: {
          id: stream.id,
          title: stream.title,
          creatorId: stream.creatorId,
          creator: stream.creator
        }
      };
      
    } catch (error) {
      logger.error(`Error validating stream connection: ${error.message}`);
      return { valid: false, message: 'Internal server error' };
    }
  }
}

module.exports = new StreamController();