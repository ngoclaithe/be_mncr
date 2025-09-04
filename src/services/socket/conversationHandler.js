class ConversationSocketHandler {
  constructor(webSocketService) {
    this.wsService = webSocketService;
    this.io = webSocketService.io;
    this.userSessions = webSocketService.userSessions;
  }

  setupHandlers(socket) {
    socket.on('join_conversation', (data) => {
      this.handleJoinConversation(socket, data);
    });

    socket.on('leave_conversation', (data) => {
      this.handleLeaveConversation(socket, data);
    });

    socket.on('send_message', (data) => {
      this.handleSendMessage(socket, data);
    });

    socket.on('typing_start', (data) => {
      this.handleTypingStart(socket, data);
    });

    socket.on('typing_stop', (data) => {
      this.handleTypingStop(socket, data);
    });

    socket.on('message_read', (data) => {
      this.handleMessageRead(socket, data);
    });
  }

  async handleJoinConversation(socket, data) {
    try {
      const { conversationId } = data;
      const userSession = this.userSessions.get(socket.id);

      if (!userSession || !conversationId) {
        socket.emit('error', { message: 'Invalid conversation or user session' });
        return;
      }

      // Verify user has access to conversation
      const { Conversation } = require('../../models');
      const conversation = await Conversation.findOne({
        where: {
          id: conversationId,
          [Op.or]: [
            { senderId: userSession.userId },
            { receiverId: userSession.userId }
          ]
        }
      });

      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found or access denied' });
        return;
      }

      socket.join(`conversation_${conversationId}`);
      
      // Track conversation in user session
      if (!userSession.conversations) {
        userSession.conversations = new Set();
      }
      userSession.conversations.add(conversationId);

      socket.emit('conversation_joined', {
        conversationId,
        timestamp: new Date().toISOString()
      });

      // Notify other participants that user joined
      socket.to(`conversation_${conversationId}`).emit('user_joined_conversation', {
        conversationId,
        userId: userSession.userId,
        username: userSession.username,
        timestamp: new Date().toISOString()
      });

      logger.info(`User ${userSession.username} joined conversation ${conversationId}`);
    } catch (error) {
      logger.error('Error handling join_conversation:', error);
      socket.emit('error', { message: 'Failed to join conversation' });
    }
  }

  handleLeaveConversation(socket, data) {
    try {
      const { conversationId } = data;
      const userSession = this.userSessions.get(socket.id);

      if (!userSession || !conversationId) {
        return;
      }

      socket.leave(`conversation_${conversationId}`);
      
      if (userSession.conversations) {
        userSession.conversations.delete(conversationId);
      }

      socket.emit('conversation_left', {
        conversationId,
        timestamp: new Date().toISOString()
      });

      // Notify other participants that user left
      socket.to(`conversation_${conversationId}`).emit('user_left_conversation', {
        conversationId,
        userId: userSession.userId,
        username: userSession.username,
        timestamp: new Date().toISOString()
      });

      logger.info(`User ${userSession.username} left conversation ${conversationId}`);
    } catch (error) {
      logger.error('Error handling leave_conversation:', error);
    }
  }

  async handleSendMessage(socket, data) {
    try {
      const { conversationId, content, messageType, mediaUrl } = data;
      const userSession = this.userSessions.get(socket.id);

      if (!userSession) {
        socket.emit('error', { message: 'User session not found' });
        return;
      }

      // Verify user is in conversation
      if (!userSession.conversations || !userSession.conversations.has(conversationId)) {
        socket.emit('error', { message: 'You must join the conversation first' });
        return;
      }

      const { Message, Conversation, User } = require('../../models');
      
      // Get conversation details
      const conversation = await Conversation.findByPk(conversationId);
      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      // Determine receiverId
      const receiverId = conversation.senderId === userSession.userId ? 
        conversation.receiverId : conversation.senderId;

      // Create message
      const message = await Message.create({
        senderId: userSession.userId,
        receiverId,
        content: messageType === 'text' ? content : null,
        messageType: messageType || 'text',
        mediaUrl: ['image', 'video', 'gift'].includes(messageType) ? mediaUrl : null
      });

      // Update conversation last message
      await conversation.update({
        lastMessageId: message.id,
        lastMessageAt: message.createdAt
      });

      // Get message with sender info
      const messageWithSender = await Message.findByPk(message.id, {
        include: [{
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        }]
      });

      const messageData = {
        id: messageWithSender.id,
        conversationId,
        sender: {
          id: messageWithSender.sender.id,
          username: messageWithSender.sender.username,
          displayName: `${messageWithSender.sender.firstName || ''} ${messageWithSender.sender.lastName || ''}`.trim(),
          avatar: messageWithSender.sender.avatar
        },
        content: messageWithSender.content,
        messageType: messageWithSender.messageType,
        mediaUrl: messageWithSender.mediaUrl,
        createdAt: messageWithSender.createdAt
      };

      // Send to all participants in conversation
      this.io.to(`conversation_${conversationId}`).emit('new_message', messageData);

      // Create notification for receiver (if not muted)
      if (!conversation.isMuted || conversation.mutedBy !== receiverId) {
        const { Notification } = require('../../models');
        await Notification.create({
          userId: receiverId,
          type: 'message',
          title: 'New Message',
          message: messageType === 'text' ? 
            `${userSession.username}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}` :
            `${userSession.username} sent a ${messageType}`,
          data: {
            conversationId,
            messageId: message.id,
            senderId: userSession.userId,
            senderUsername: userSession.username,
            messageType
          }
        });

        // Send notification via socket if receiver is online
        const receiverSocketId = this.findSocketByUserId(receiverId);
        if (receiverSocketId) {
          const receiverSocket = this.io.sockets.sockets.get(receiverSocketId);
          if (receiverSocket) {
            receiverSocket.emit('notification', {
              type: 'message',
              title: 'New Message',
              message: messageType === 'text' ? 
                `${userSession.username}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}` :
                `${userSession.username} sent a ${messageType}`,
              data: {
                conversationId,
                messageId: message.id,
                senderId: userSession.userId,
                senderUsername: userSession.username,
                messageType
              },
              createdAt: new Date().toISOString()
            });
          }
        }
      }

      logger.info(`Message sent in conversation ${conversationId} by ${userSession.username}`);
    } catch (error) {
      logger.error('Error handling send_message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  handleTypingStart(socket, data) {
    try {
      const { conversationId } = data;
      const userSession = this.userSessions.get(socket.id);

      if (!userSession || !conversationId) {
        return;
      }

      socket.to(`conversation_${conversationId}`).emit('typing_start', {
        conversationId,
        userId: userSession.userId,
        username: userSession.username,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error handling typing_start:', error);
    }
  }

  handleTypingStop(socket, data) {
    try {
      const { conversationId } = data;
      const userSession = this.userSessions.get(socket.id);

      if (!userSession || !conversationId) {
        return;
      }

      socket.to(`conversation_${conversationId}`).emit('typing_stop', {
        conversationId,
        userId: userSession.userId,
        username: userSession.username,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error handling typing_stop:', error);
    }
  }

  handleMessageRead(socket, data) {
    try {
      const { conversationId, messageId } = data;
      const userSession = this.userSessions.get(socket.id);

      if (!userSession || !conversationId || !messageId) {
        return;
      }

      socket.to(`conversation_${conversationId}`).emit('message_read', {
        conversationId,
        messageId,
        readBy: {
          userId: userSession.userId,
          username: userSession.username
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error handling message_read:', error);
    }
  }

  findSocketByUserId(userId) {
    for (let [socketId, session] of this.userSessions.entries()) {
      if (session.userId === userId) {
        return socketId;
      }
    }
    return null;
  }

  // Clean up conversation sessions on disconnect
  handleDisconnect(socket) {
    try {
      const userSession = this.userSessions.get(socket.id);
      if (!userSession || !userSession.conversations) return;

      // Leave all conversations
      for (let conversationId of userSession.conversations) {
        socket.to(`conversation_${conversationId}`).emit('user_left_conversation', {
          conversationId,
          userId: userSession.userId,
          username: userSession.username,
          timestamp: new Date().toISOString()
        });
      }

      logger.info(`User ${userSession.username} disconnected from all conversations`);
    } catch (error) {
      logger.error('Error handling conversation disconnect:', error);
    }
  }
}
module.exports = ConversationSocketHandler;