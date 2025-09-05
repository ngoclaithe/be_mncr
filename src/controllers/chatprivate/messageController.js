const { Op } = require('sequelize');
const { User, Conversation, Message, Notification } = require('../../models');
const logger = require('../../utils/logger');
const ApiError = require('../../utils/ApiError');
const mqttService = require('../../services/mqtt/mqtt');

class MessageController {
  // GET /api/conversations/:conversationId/messages - Lấy messages trong conversation
  async getMessages(req, res) {
    try {
      const userId = req.user.id;
      const conversationId = req.params.conversationId;
      const { page = 1, limit = 50, before, after, messageType } = req.query;
      const offset = (page - 1) * limit;

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

      // Build where condition
      let whereCondition = {
        [Op.or]: [
          { senderId: userId, receiverId: conversation.senderId === userId ? conversation.receiverId : conversation.senderId },
          { senderId: conversation.senderId === userId ? conversation.receiverId : conversation.senderId, receiverId: userId }
        ],
        isDeleted: false
      };

      // Add time filters
      if (before) {
        whereCondition.createdAt = { ...whereCondition.createdAt, [Op.lt]: new Date(before) };
      }
      if (after) {
        whereCondition.createdAt = { ...whereCondition.createdAt, [Op.gt]: new Date(after) };
      }

      // Add message type filter
      if (messageType) {
        whereCondition.messageType = messageType;
      }

      const { count, rows: messages } = await Message.findAndCountAll({
        where: whereCondition,
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
          },
          {
            model: User,
            as: 'receiver',
            attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset,
        distinct: true
      });

      res.json({
        success: true,
        data: {
          messages: messages.map(msg => ({
            id: msg.id,
            sender: {
              id: msg.sender.id,
              username: msg.sender.username,
              displayName: `${msg.sender.firstName || ''} ${msg.sender.lastName || ''}`.trim(),
              avatar: msg.sender.avatar
            },
            receiver: {
              id: msg.receiver.id,
              username: msg.receiver.username,
              displayName: `${msg.receiver.firstName || ''} ${msg.receiver.lastName || ''}`.trim(),
              avatar: msg.receiver.avatar
            },
            content: msg.content,
            messageType: msg.messageType,
            mediaUrl: msg.mediaUrl,
            reactions: msg.reactions || [],
            createdAt: msg.createdAt,
            updatedAt: msg.updatedAt
          })),
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit),
            totalItems: count,
            itemsPerPage: parseInt(limit)
          }
        }
      });
    } catch (error) {
      logger.error('Error getting messages:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

// POST /api/conversations/:conversationId/messages - Tạo message mới
async createMessage(req, res) {
  try {
    const senderId = req.user.id;
    const conversationId = req.params.conversationId;
    let { content, messageType, mediaUrl } = req.body;

    // Fix: Nếu không có messageType nhưng có content, mặc định là 'text'
    if (!messageType && content && typeof content === 'string' && content.trim()) {
      messageType = 'text';
    }

    // Fix: Nếu messageType là 'text' nhưng không có content, báo lỗi
    if (messageType === 'text' && (!content || !content.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Content is required for text messages'
      });
    }

    const webSocketService = req.app.get('webSocketService');
    const callHandler = webSocketService ? webSocketService.callHandler : null;

    const conversation = await Conversation.findOne({
      where: {
        id: conversationId,
        [Op.or]: [
          { senderId },
          { receiverId: senderId }
        ]
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        },
        {
          model: User,
          as: 'receiver',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        }
      ]
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Kiểm tra conversation có bị block không
    if (conversation.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot send message to blocked conversation'
      });
    }

    // Xác định receiverId
    const receiverId = conversation.senderId === senderId ? conversation.receiverId : conversation.senderId;

    // Tạo message mới
    const message = await Message.create({
      conversationId: conversationId,
      senderId,
      receiverId,
      content: messageType === 'text' ? content : null,
      messageType: messageType || 'text',
      mediaUrl: ['image', 'video', 'gift'].includes(messageType) ? mediaUrl : null
    });

    // Cập nhật lastMessage và lastMessageAt trong conversation
    await conversation.update({
      lastMessageId: message.id,
      lastMessageAt: message.createdAt
    });

    // Reload message với thông tin sender
    const newMessage = await Message.findByPk(message.id, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        },
        {
          model: User,
          as: 'receiver',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        }
      ]
    });

    let responseData = {
      message: {
        id: newMessage.id,
        sender: {
          id: newMessage.sender.id,
          username: newMessage.sender.username,
          displayName: `${newMessage.sender.firstName || ''} ${newMessage.sender.lastName || ''}`.trim(),
          avatar: newMessage.sender.avatar
        },
        receiver: {
          id: newMessage.receiver.id,
          username: newMessage.receiver.username,
          displayName: `${newMessage.receiver.firstName || ''} ${newMessage.receiver.lastName || ''}`.trim(),
          avatar: newMessage.receiver.avatar
        },
        content: newMessage.content,
        messageType: newMessage.messageType,
        mediaUrl: newMessage.mediaUrl,
        reactions: newMessage.reactions || [],
        createdAt: newMessage.createdAt,
        updatedAt: newMessage.updatedAt
      }
    };

    if (messageType === 'audio' || messageType === 'video') {
      const callRoomId = `call_${conversation.topic || conversationId}_${Date.now()}`;

      await MessageController.createNotification(receiverId, {
        type: 'call_request',
        title: `${messageType === 'audio' ? 'Voice' : 'Video'} Call`,
        message: `${req.user.username} is calling you`,
        data: {
          conversationId: conversationId,
          messageId: message.id,
          senderId: senderId,
          senderUsername: req.user.username,
          messageType,
          callRoomId: callRoomId,
          callType: messageType
        }
      });

      if (callHandler && callHandler.createCallRoom) {
        callHandler.createCallRoom(callRoomId, {
          conversationId,
          messageId: message.id,
          callerId: senderId,
          callerUsername: req.user.username,
          receiverId: receiverId,
          receiverUsername: newMessage.receiver.username,
          callType: messageType,
          createdAt: Date.now()
        });
      }

      responseData.callRoom = {
        roomId: callRoomId,
        callType: messageType,
        status: 'waiting'
      };

      logger.info(`${messageType} call initiated from user ${senderId} to ${receiverId}, room: ${callRoomId}`);
    }

    res.status(201).json({
      success: true,
      data: responseData
    });

    logger.info(`Message sent from user ${senderId} to ${receiverId} in conversation ${conversationId}`);
  } catch (error) {
    logger.error('Error creating message:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
  // GET /api/messages/:id - Lấy chi tiết message
  async getMessageById(req, res) {
    try {
      const userId = req.user.id;
      const messageId = req.params.id;

      const message = await Message.findOne({
        where: {
          id: messageId,
          [Op.or]: [
            { senderId: userId },
            { receiverId: userId }
          ],
          isDeleted: false
        },
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
          },
          {
            model: User,
            as: 'receiver',
            attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
          }
        ]
      });

      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      }

      res.json({
        success: true,
        data: {
          message: {
            id: message.id,
            sender: {
              id: message.sender.id,
              username: message.sender.username,
              displayName: `${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim(),
              avatar: message.sender.avatar
            },
            receiver: {
              id: message.receiver.id,
              username: message.receiver.username,
              displayName: `${message.receiver.firstName || ''} ${message.receiver.lastName || ''}`.trim(),
              avatar: message.receiver.avatar
            },
            content: message.content,
            messageType: message.messageType,
            mediaUrl: message.mediaUrl,
            reactions: message.reactions || [],
            createdAt: message.createdAt,
            updatedAt: message.updatedAt
          }
        }
      });
    } catch (error) {
      logger.error('Error getting message:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // PUT /api/messages/:id/react - React to message
  async reactToMessage(req, res) {
    try {
      const userId = req.user.id;
      const messageId = req.params.id;
      const { emoji } = req.body;

      const message = await Message.findOne({
        where: {
          id: messageId,
          [Op.or]: [
            { senderId: userId },
            { receiverId: userId }
          ],
          isDeleted: false
        }
      });

      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      }

      let reactions = message.reactions || [];

      // Tìm reaction hiện tại của user
      const existingReactionIndex = reactions.findIndex(r => r.userId === userId);

      if (existingReactionIndex !== -1) {
        if (reactions[existingReactionIndex].emoji === emoji) {
          // Remove reaction nếu cùng emoji
          reactions.splice(existingReactionIndex, 1);
        } else {
          // Update emoji
          reactions[existingReactionIndex].emoji = emoji;
        }
      } else {
        // Add new reaction
        reactions.push({
          userId,
          emoji,
          createdAt: new Date().toISOString()
        });
      }

      await message.update({ reactions });

      res.json({
        success: true,
        data: {
          reactions
        }
      });

      logger.info(`User ${userId} reacted to message ${messageId} with ${emoji}`);
    } catch (error) {
      logger.error('Error reacting to message:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // DELETE /api/messages/:id - Delete message
  async deleteMessage(req, res) {
    try {
      const userId = req.user.id;
      const messageId = req.params.id;

      const message = await Message.findOne({
        where: {
          id: messageId,
          senderId: userId, // Chỉ người gửi mới có thể xóa
          isDeleted: false
        }
      });

      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found or you do not have permission to delete it'
        });
      }

      await message.update({
        isDeleted: true,
        deletedAt: new Date()
      });

      res.json({
        success: true,
        message: 'Message deleted successfully'
      });

      logger.info(`Message ${messageId} deleted by user ${userId}`);
    } catch (error) {
      logger.error('Error deleting message:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Static method để tạo notification
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
}

module.exports = new MessageController();
