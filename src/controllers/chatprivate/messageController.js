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
      // Debug thông tin đầu vào
      console.log("=== CREATE MESSAGE DEBUG ===");
      console.log("1. Request body:", req.body);
      console.log("2. User ID:", req.user.id);
      console.log("3. Conversation ID:", req.params.conversationId);

      const senderId = req.user.id;
      const conversationId = req.params.conversationId;
      const { content, messageType, mediaUrl } = req.body;

      console.log("4. Extracted data:", {
        senderId,
        conversationId,
        content,
        messageType,
        mediaUrl
      });

      const webSocketService = req.app.get('webSocketService');
      const callHandler = webSocketService ? webSocketService.callHandler : null;

      console.log("5. WebSocket service available:", !!webSocketService);
      console.log("6. Call handler available:", !!callHandler);

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

      console.log("7. Conversation found:", !!conversation);
      if (conversation) {
        console.log("8. Conversation details:", {
          id: conversation.id,
          senderId: conversation.senderId,
          receiverId: conversation.receiverId,
          isBlocked: conversation.isBlocked
        });
      }

      if (!conversation) {
        console.log("❌ Conversation not found");
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      // Kiểm tra conversation có bị block không
      if (conversation.isBlocked) {
        console.log("❌ Conversation is blocked");
        return res.status(403).json({
          success: false,
          message: 'Cannot send message to blocked conversation'
        });
      }

      // Xác định receiverId
      const receiverId = conversation.senderId === senderId ? conversation.receiverId : conversation.senderId;
      console.log("9. Receiver ID determined:", receiverId);

      // Tạo message mới
      const messageData = {
        conversationId: conversationId,
        senderId,
        receiverId,
        content: messageType === 'text' ? content : null,
        messageType,
        mediaUrl: ['image', 'video', 'gift'].includes(messageType) ? mediaUrl : null
      };

      console.log("10. Message data to create:", messageData);

      const message = await Message.create(messageData);
      console.log("11. Message created with ID:", message.id);

      // Cập nhật lastMessage và lastMessageAt trong conversation
      await conversation.update({
        lastMessageId: message.id,
        lastMessageAt: message.createdAt
      });
      console.log("12. Conversation updated with last message");

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

      console.log("13. Message reloaded with user info");

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

      // Xử lý call cho audio/video
      if (messageType === 'audio' || messageType === 'video') {
        console.log("14. Processing audio/video call");

        const callRoomId = `call_${conversation.topic || conversationId}_${Date.now()}`;
        console.log("15. Call room ID generated:", callRoomId);

        // Tạo notification cho receiver
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
        console.log("16. Notification created for receiver");

        // Tạo call room trong call handler
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
          console.log("17. Call room created in call handler");
        } else {
          console.log("17. Call handler not available or createCallRoom method missing");
        }

        // Thêm thông tin call room vào response
        responseData.callRoom = {
          roomId: callRoomId,
          callType: messageType,
          status: 'waiting'
        };

        console.log("18. Call room info added to response");
        logger.info(`${messageType} call initiated from user ${senderId} to ${receiverId}, room: ${callRoomId}`);
      }

      console.log("19. Final response data:", JSON.stringify(responseData, null, 2));
      console.log("=== CREATE MESSAGE SUCCESS ===");

      res.status(201).json({
        success: true,
        data: responseData
      });

      logger.info(`Message sent from user ${senderId} to ${receiverId} in conversation ${conversationId}`);
    } catch (error) {
      console.error("❌ CREATE MESSAGE ERROR:", error);
      console.error("Error stack:", error.stack);
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
