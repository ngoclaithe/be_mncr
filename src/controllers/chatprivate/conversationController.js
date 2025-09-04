const { Op } = require('sequelize');
const { User, Conversation, Message, Notification } = require('../../models');
const logger = require('../../utils/logger');
const ApiError = require('../../utils/ApiError');
const mqttService = require('../../services/mqtt/mqtt');

class ConversationController {
  static generateUniqueMqttTopic() {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    return `chat/${timestamp}_${randomStr}`;
  }

  static async createNotification(userId, notificationData) {
    try {
      await Notification.create({
        userId,
        ...notificationData
      });
      await mqttService.publish(`notifications/${userId}`, JSON.stringify(notificationData));
    } catch (error) {
      logger.error('Error creating notification:', error);
    }
  }

  // GET /api/conversations - Lấy danh sách conversations
  async getConversations(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, search } = req.query;
      const offset = (page - 1) * limit;

      let whereCondition = {
        [Op.or]: [
          { senderId: userId },
          { receiverId: userId }
        ]
      };

      // Build include để join với User
      let includeConditions = [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'isOnline']
        },
        {
          model: User,
          as: 'receiver',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'isOnline']
        },
        {
          model: Message,
          as: 'lastMessage',
          attributes: ['id', 'content', 'messageType', 'mediaUrl', 'createdAt'],
          required: false
        }
      ];

      // Nếu có search, thêm điều kiện tìm kiếm
      if (search) {
        includeConditions[0].where = {
          [Op.or]: [
            { username: { [Op.iLike]: `%${search}%` } },
            { firstName: { [Op.iLike]: `%${search}%` } },
            { lastName: { [Op.iLike]: `%${search}%` } }
          ]
        };
        includeConditions[1].where = {
          [Op.or]: [
            { username: { [Op.iLike]: `%${search}%` } },
            { firstName: { [Op.iLike]: `%${search}%` } },
            { lastName: { [Op.iLike]: `%${search}%` } }
          ]
        };
      }

      const { count, rows: conversations } = await Conversation.findAndCountAll({
        where: whereCondition,
        include: includeConditions,
        order: [['lastMessageAt', 'DESC']],
        limit: parseInt(limit),
        offset,
        distinct: true
      });

      // Format dữ liệu trả về
      const formattedConversations = conversations.map(conv => {
        const otherUser = conv.senderId === userId ? conv.receiver : conv.sender;
        return {
          id: conv.id,
          otherUser: {
            id: otherUser.id,
            username: otherUser.username,
            displayName: `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim(),
            avatar: otherUser.avatar,
            isOnline: otherUser.isOnline
          },
          lastMessage: conv.lastMessage ? {
            id: conv.lastMessage.id,
            content: conv.lastMessage.content,
            messageType: conv.lastMessage.messageType,
            mediaUrl: conv.lastMessage.mediaUrl,
            createdAt: conv.lastMessage.createdAt
          } : null,
          lastMessageAt: conv.lastMessageAt,
          isBlocked: conv.isBlocked,
          blockedBy: conv.blockedBy,
          isMuted: conv.isMuted,
          mutedBy: conv.mutedBy,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          topic: conv.topic
        };
      });

      res.json({
        success: true,
        data: {
          conversations: formattedConversations,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit),
            totalItems: count,
            itemsPerPage: parseInt(limit)
          }
        }
      });
    } catch (error) {
      logger.error('Error getting conversations:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // POST /api/conversations - Tạo conversation mới với random topic
  async createConversation(req, res) {
    try {
      const senderId = req.user.id;
      const { receiverId } = req.body;

      // Kiểm tra không thể tự nhắn tin với chính mình
      if (senderId === receiverId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot create conversation with yourself'
        });
      }

      // Kiểm tra receiver có tồn tại không
      const receiver = await User.findByPk(receiverId);
      if (!receiver) {
        return res.status(404).json({
          success: false,
          message: 'Receiver not found'
        });
      }

      // Kiểm tra conversation đã tồn tại chưa
      let conversation = await Conversation.findOne({
        where: {
          [Op.or]: [
            { senderId, receiverId },
            { senderId: receiverId, receiverId: senderId }
          ]
        },
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'isOnline']
          },
          {
            model: User,
            as: 'receiver',
            attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'isOnline']
          }
        ]
      });

      let isNew = false;
      let mqttTopic = null;

      if (!conversation) {
        // Generate unique MQTT topic cho conversation mới
        let isTopicUnique = false;
        
        // Retry cho đến khi tìm được topic unique
        while (!isTopicUnique) {
          mqttTopic = ConversationController.generateUniqueMqttTopic();
          
          const existingTopic = await Conversation.findOne({
            where: { topic: mqttTopic }
          });
          
          if (!existingTopic) {
            isTopicUnique = true;
          }
        }
        
        // Tạo conversation mới với MQTT topic
        conversation = await Conversation.create({
          senderId,
          receiverId,
          topic: mqttTopic
        });

        // Reload để lấy thông tin user
        conversation = await Conversation.findByPk(conversation.id, {
          include: [
            {
              model: User,
              as: 'sender',
              attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'isOnline']
            },
            {
              model: User,
              as: 'receiver',
              attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'isOnline']
            }
          ]
        });
        isNew = true;

        await ConversationController.createNotification(receiverId, {
          type: 'message',
          title: 'New Conversation',
          message: `${req.user.username} started a conversation with you`,
          data: {
            conversationId: conversation.id,
            senderId: senderId,
            senderUsername: req.user.username,
            mqttTopic: mqttTopic
          }
        });

        logger.info(`New conversation created between users ${senderId} and ${receiverId} with MQTT topic: ${mqttTopic}`);
      }

      // Format response
      const otherUser = conversation.senderId === senderId ? conversation.receiver : conversation.sender;
      
      res.status(isNew ? 201 : 200).json({
        success: true,
        data: {
          conversation: {
            id: conversation.id,
            otherUser: {
              id: otherUser.id,
              username: otherUser.username,
              displayName: `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim(),
              avatar: otherUser.avatar,
              isOnline: otherUser.isOnline
            },
            lastMessage: null,
            lastMessageAt: conversation.lastMessageAt,
            isBlocked: conversation.isBlocked,
            blockedBy: conversation.blockedBy,
            isMuted: conversation.isMuted,
            mutedBy: conversation.mutedBy,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
            topic: conversation.topic
          },
          isNew,
          mqttTopic: isNew ? mqttTopic : null
        }
      });
    } catch (error) {
      logger.error('Error creating conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // GET /api/conversations/:id - Lấy chi tiết conversation
  async getConversationById(req, res) {
    try {
      const userId = req.user.id;
      const conversationId = req.params.id;

      const conversation = await Conversation.findOne({
        where: {
          id: conversationId,
          [Op.or]: [
            { senderId: userId },
            { receiverId: userId }
          ]
        },
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'isOnline']
          },
          {
            model: User,
            as: 'receiver',
            attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'isOnline']
          },
          {
            model: Message,
            as: 'lastMessage',
            attributes: ['id', 'content', 'messageType', 'mediaUrl', 'createdAt']
          }
        ]
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      const otherUser = conversation.senderId === userId ? conversation.receiver : conversation.sender;

      res.json({
        success: true,
        data: {
          conversation: {
            id: conversation.id,
            otherUser: {
              id: otherUser.id,
              username: otherUser.username,
              displayName: `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim(),
              avatar: otherUser.avatar,
              isOnline: otherUser.isOnline
            },
            lastMessage: conversation.lastMessage ? {
              id: conversation.lastMessage.id,
              content: conversation.lastMessage.content,
              messageType: conversation.lastMessage.messageType,
              mediaUrl: conversation.lastMessage.mediaUrl,
              createdAt: conversation.lastMessage.createdAt
            } : null,
            lastMessageAt: conversation.lastMessageAt,
            isBlocked: conversation.isBlocked,
            blockedBy: conversation.blockedBy,
            isMuted: conversation.isMuted,
            mutedBy: conversation.mutedBy,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
            topic: conversation.topic
          }
        }
      });
    } catch (error) {
      logger.error('Error getting conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // PUT /api/conversations/:id/block - Block/unblock conversation
  async blockConversation(req, res) {
    try {
      const userId = req.user.id;
      const conversationId = req.params.id;
      const { isBlocked } = req.body;

      const conversation = await Conversation.findOne({
        where: {
          id: conversationId,
          [Op.or]: [
            { senderId: userId },
            { receiverId: userId }
          ]
        }
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      await conversation.update({
        isBlocked,
        blockedBy: isBlocked ? userId : null
      });

      res.json({
        success: true,
        message: `Conversation ${isBlocked ? 'blocked' : 'unblocked'} successfully`,
        data: {
          isBlocked: conversation.isBlocked,
          blockedBy: conversation.blockedBy
        }
      });

      logger.info(`Conversation ${conversationId} ${isBlocked ? 'blocked' : 'unblocked'} by user ${userId}`);
    } catch (error) {
      logger.error('Error blocking conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // PUT /api/conversations/:id/mute - Mute/unmute conversation
  async muteConversation(req, res) {
    try {
      const userId = req.user.id;
      const conversationId = req.params.id;
      const { isMuted } = req.body;

      const conversation = await Conversation.findOne({
        where: {
          id: conversationId,
          [Op.or]: [
            { senderId: userId },
            { receiverId: userId }
          ]
        }
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      await conversation.update({
        isMuted,
        mutedBy: isMuted ? userId : null
      });

      res.json({
        success: true,
        message: `Conversation ${isMuted ? 'muted' : 'unmuted'} successfully`,
        data: {
          isMuted: conversation.isMuted,
          mutedBy: conversation.mutedBy
        }
      });

      logger.info(`Conversation ${conversationId} ${isMuted ? 'muted' : 'unmuted'} by user ${userId}`);
    } catch (error) {
      logger.error('Error muting conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // DELETE /api/conversations/:id - Delete conversation
  async deleteConversation(req, res) {
    try {
      const userId = req.user.id;
      const conversationId = req.params.id;

      const conversation = await Conversation.findOne({
        where: {
          id: conversationId,
          [Op.or]: [
            { senderId: userId },
            { receiverId: userId }
          ]
        }
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      // Xóa tất cả messages trong conversation
      await Message.destroy({
        where: {
          [Op.or]: [
            { senderId: userId, receiverId: conversation.senderId === userId ? conversation.receiverId : conversation.senderId },
            { senderId: conversation.senderId === userId ? conversation.receiverId : conversation.senderId, receiverId: userId }
          ]
        }
      });

      // Xóa conversation
      await conversation.destroy();

      res.json({
        success: true,
        message: 'Conversation deleted successfully'
      });

      logger.info(`Conversation ${conversationId} deleted by user ${userId}`);
    } catch (error) {
      logger.error('Error deleting conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // PUT /api/conversations/:id/topic - Cập nhật topic của conversation
  async updateConversationTopic(req, res) {
    try {
      const userId = req.user.id;
      const conversationId = req.params.id;
      const { topic } = req.body;

      const conversation = await Conversation.findOne({
        where: {
          id: conversationId,
          [Op.or]: [
            { senderId: userId },
            { receiverId: userId }
          ]
        }
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      // Kiểm tra topic có trùng không (nếu cần unique)
      if (topic) {
        const existingConversation = await Conversation.findOne({
          where: {
            topic,
            id: { [Op.ne]: conversationId }
          }
        });

        if (existingConversation) {
          return res.status(400).json({
            success: false,
            message: 'Topic already exists for another conversation'
          });
        }
      }

      await conversation.update({ topic });

      res.json({
        success: true,
        message: 'Conversation topic updated successfully',
        data: {
          topic: conversation.topic
        }
      });

      logger.info(`Conversation ${conversationId} topic updated to: ${topic} by user ${userId}`);
    } catch (error) {
      logger.error('Error updating conversation topic:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // GET /api/conversations/topics/random - Lấy random topic mới
  async getRandomTopic(req, res) {
    try {
      const randomTopic = ConversationController.generateUniqueMqttTopic();
      
      res.json({
        success: true,
        data: {
          topic: randomTopic
        }
      });
    } catch (error) {
      logger.error('Error getting random topic:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = new ConversationController();