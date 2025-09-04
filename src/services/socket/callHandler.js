const jwt = require('jsonwebtoken');
const config = require('../../config');
const logger = require('../../utils/logger');

class CallHandler {
  constructor(webSocketService) {
    this.wsService = webSocketService;
    this.io = webSocketService.io;
    this.userSessions = webSocketService.userSessions;
    this.callRooms = new Map();
  }

  // Method để verify JWT token
  verifyToken(socket, token) {
    try {
      console.log(`[DEBUG] Verifying token for socket ${socket.id}`);

      if (!token) {
        throw new Error('Token is required');
      }

      const decoded = jwt.verify(token, config.jwt.secret);
      console.log(`[DEBUG] Token decoded successfully:`, decoded);

      if (!decoded.id) {
        throw new Error('Invalid token payload - missing id');
      }

      return decoded;
    } catch (error) {
      console.log('[DEBUG] Token verification failed:', error.message);
      logger.error(`Token verification failed for socket ${socket.id}:`, error);
      socket.emit('error', {
        message: 'Authentication failed',
        code: 'UNAUTHORIZED',
        details: error.message
      });
      return null;
    }
  }

  setupHandlers(socket) {
    // Call management handlers
    socket.on('join_call_room', (data) => {
      this.handleJoinCallRoom(socket, data);
    });

    socket.on('leave_call_room', (data) => {
      this.handleLeaveCallRoom(socket, data);
    });

    socket.on('call_answer', (data) => {
      this.handleCallAnswer(socket, data);
    });

    socket.on('call_reject', (data) => {
      this.handleCallReject(socket, data);
    });

    socket.on('call_end', (data) => {
      this.handleCallEnd(socket, data);
    });

    // offer
    socket.on('webrtc_offer', (data) => {
      this.handleOffer(socket, data);
    });
    socket.on('webrtc_answer', (data) => {
      this.handleAnswer(socket, data);
    });

    // WebRTC handlers - THÊM MỚI
    socket.on('ice_candidate', (data) => {
      this.handleIceCandidate(socket, data);
    });

    socket.on('hang_up', (data) => {
      this.handleHangUp(socket, data);
    });

    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });
  }

  createCallRoom(callRoomId, callData) {
    try {
      const { conversationId, messageId, callerId, callerUsername, receiverId, receiverUsername, callType } = callData;

      const callRoom = {
        id: callRoomId,
        conversationId,
        messageId,
        callerId,
        callerUsername,
        receiverId,
        receiverUsername,
        callType,
        status: 'waiting',
        participants: new Set(),
        createdAt: Date.now()
      };

      this.callRooms.set(callRoomId, callRoom);

      console.log(`Call room ${callRoomId} created for ${callType} call from ${callerUsername} to ${receiverUsername}`);
      return callRoom;
    } catch (error) {
      logger.error('Error creating call room:', error);
      return null;
    }
  }

  // Xử lý offer - chỉ forward thôi
  handleOffer(socket, data) {
    try {
      console.log(`[Socket RECV] webrtc_offer from ${socket.id}: ${JSON.stringify(data)}`);
      const { callRoomId, offer } = data;

      const callRoom = this.callRooms.get(callRoomId);
      if (!callRoom || !callRoom.participants.has(socket.id)) {
        console.log(`[DEBUG] Offer ignored - invalid room or participant for socket ${socket.id}`);
        return; 
      }

      socket.to(callRoomId).emit('webrtc_offerd', {
        callRoomId,
        offer,
        fromSocket: socket.id
      });

      console.log(`[DEBUG] Offer forwarded in room ${callRoomId} from socket ${socket.id}`);

    } catch (error) {
      logger.error('Error forwarding offer:', error);
    }
  }

  handleAnswer(socket, data) {
    try {
      console.log(`[Socket RECV] webrtc_answer from ${socket.id}: ${JSON.stringify(data)}`);
      const { callRoomId, answer } = data;

      const callRoom = this.callRooms.get(callRoomId);
      if (!callRoom || !callRoom.participants.has(socket.id)) {
        console.log(`[DEBUG] Offer ignored - invalid room or participant for socket ${socket.id}`);
        return; 
      }

      socket.to(callRoomId).emit('webrtc_answered', {
        callRoomId,
        answer,
        fromSocket: socket.id
      });

      console.log(`[DEBUG] Answer forwarded in room ${callRoomId} from socket ${socket.id}`);

    } catch (error) {
      logger.error('Error forwarding answer:', error);
    }
  }
  
  handleIceCandidate(socket, data) {
    try {
      console.log(`[Socket RECV] ice_candidate from ${socket.id}: ${JSON.stringify(data)}`);
      const { callRoomId, candidate } = data;

      const callRoom = this.callRooms.get(callRoomId);
      if (!callRoom || !callRoom.participants.has(socket.id)) {
        console.log(`[DEBUG] ICE candidate ignored - invalid room or participant for socket ${socket.id}`);
        return; // Không cần emit error, chỉ bỏ qua
      }

      socket.to(callRoomId).emit('ice_candidated', {
        callRoomId,
        candidate,
        fromSocket: socket.id
      });

      console.log(`[DEBUG] ICE candidate forwarded in room ${callRoomId} from socket ${socket.id}`);

    } catch (error) {
      logger.error('Error forwarding ICE candidate:', error);
    }
  }

  // THÊM MỚI: Xử lý hang up - chỉ forward và cleanup
  handleHangUp(socket, data) {
    try {
      const { callRoomId, token } = data;

      if (!token) {
        socket.emit('error', { message: 'Authentication token required' });
        return;
      }

      const decoded = this.verifyToken(socket, token);
      if (!decoded) return;

      const callRoom = this.callRooms.get(callRoomId);
      if (!callRoom || !callRoom.participants.has(socket.id)) {
        return; // Không cần emit error, chỉ bỏ qua
      }

      const userSession = this.userSessions.get(socket.id);
      if (!userSession) return;

      // Forward hang up signal đến participants khác
      socket.to(callRoomId).emit('hang_up', {
        callRoomId,
        fromUserId: userSession.userId,
        fromUsername: userSession.username,
        timestamp: Date.now()
      });

      // Cleanup call room
      this.closeCallRoom(callRoomId, 'hang_up');

      console.log(`Hang up signal sent and call room ${callRoomId} closed by ${userSession.username}`);

    } catch (error) {
      logger.error('Error handling hang up:', error);
    }
  }

  notifyCallToReceiver(receiverId, callData) {
    try {
      for (let [socketId, session] of this.userSessions.entries()) {
        if (String(session.userId) === String(receiverId)) {
          const receiverSocket = this.io.sockets.sockets.get(socketId);
          if (receiverSocket) {
            receiverSocket.emit('incoming_call', callData);
            console.log(`Incoming call notification sent to user ${receiverId}`);
          }
          break;
        }
      }
    } catch (error) {
      logger.error('Error notifying call to receiver:', error);
    }
  }

  handleJoinCallRoom(socket, data) {
    try {
      console.log(`[Socket RECV] join_call_room from ${socket.id}: ${JSON.stringify(data)}`);
      const { callRoomId, token } = data;

      if (!token) {
        socket.emit('error', { message: 'Authentication token required' });
        return;
      }

      const callRoom = this.callRooms.get(callRoomId);
      if (!callRoom) {
        socket.emit('error', { message: 'Call room not found or expired' });
        return;
      }

      // Verify JWT token
      const decoded = this.verifyToken(socket, token);
      if (!decoded) return;

      // Check if user is caller or receiver
      const isCaller = String(decoded.id) === String(callRoom.callerId);
      const isReceiver = String(decoded.id) === String(callRoom.receiverId);

      if (!isCaller && !isReceiver) {
        socket.emit('error', {
          message: 'You are not authorized to join this call',
          code: 'FORBIDDEN'
        });
        return;
      }

      // Update user session with info from token
      const userSession = this.userSessions.get(socket.id) || {};
      userSession.userId = decoded.id;
      userSession.username = decoded.userName;
      userSession.authenticated = true;
      this.userSessions.set(socket.id, userSession);

      if (callRoom.participants.size >= 2) {
        socket.emit('error', { message: 'Call room is full' });
        return;
      }

      socket.join(callRoomId);
      callRoom.participants.add(socket.id);

      if (!userSession.callRooms) {
        userSession.callRooms = new Set();
      }
      userSession.callRooms.add(callRoomId);

      if (callRoom.participants.size === 2) {
        callRoom.status = 'active';
        this.io.to(callRoomId).emit('call_started', {
          callRoomId,
          callType: callRoom.callType,
          participants: callRoom.participants.size,
          timestamp: Date.now()
        });
      }

      socket.emit('call_room_joined', {
        callRoomId,
        callType: callRoom.callType,
        participants: callRoom.participants.size,
        status: callRoom.status,
        timestamp: Date.now()
      });

      socket.to(callRoomId).emit('user_joined_call', {
        callRoomId,
        userId: userSession.userId,
        username: userSession.username,
        participants: callRoom.participants.size,
        timestamp: Date.now()
      });

      console.log(`User ${userSession.username} joined call room ${callRoomId}`);
    } catch (error) {
      logger.error(`Error handling join_call_room:`, error);
      socket.emit('error', { message: 'Failed to join call room' });
    }
  }

  handleLeaveCallRoom(socket, data) {
    try {
      console.log(`[Socket RECV] leave_call_room from ${socket.id}: ${JSON.stringify(data)}`);
      const { callRoomId, token } = data;

      if (!token) {
        socket.emit('error', { message: 'Authentication token required' });
        return;
      }

      const decoded = this.verifyToken(socket, token);
      if (!decoded) return;

      const userSession = this.userSessions.get(socket.id);
      if (!userSession) {
        socket.emit('error', { message: 'User session not found' });
        return;
      }

      const callRoom = this.callRooms.get(callRoomId);
      if (!callRoom) {
        socket.emit('error', { message: 'Call room not found' });
        return;
      }

      // Verify user is in this call room
      const isCaller = String(decoded.id) === String(callRoom.callerId);
      const isReceiver = String(decoded.id) === String(callRoom.receiverId);
      const isParticipant = callRoom.participants.has(socket.id);

      if (!isCaller && !isReceiver && !isParticipant) {
        socket.emit('error', {
          message: 'You are not in this call room',
          code: 'FORBIDDEN'
        });
        return;
      }

      this.leaveCallRoom(socket, callRoomId);

    } catch (error) {
      logger.error(`Error handling leave_call_room:`, error);
      socket.emit('error', { message: 'Failed to leave call room' });
    }
  }

  handleCallAnswer(socket, data) {
    try {
      console.log(`[Socket RECV] call_answer from ${socket.id}: ${JSON.stringify(data)}`);
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (parseError) {
          socket.emit('error', { message: 'Invalid data format' });
          return;
        }
      }    
      const { callRoomId, token } = data;

      if (!token) {
        socket.emit('error', { message: 'Authentication token required' });
        return;
      }

      const callRoom = this.callRooms.get(callRoomId);
      if (!callRoom) {
        socket.emit('error', { message: 'Call room not found or expired' });
        return;
      }

      // Verify JWT token
      const decoded = this.verifyToken(socket, token);
      if (!decoded) return;

      // Check if user is the receiver
      if (String(decoded.id) !== String(callRoom.receiverId)) {
        socket.emit('error', {
          message: 'You are not authorized to answer this call',
          code: 'FORBIDDEN'
        });
        return;
      }

      // Update user session
      const userSession = this.userSessions.get(socket.id) || {};
      userSession.userId = decoded.id;
      userSession.username = decoded.userName;
      userSession.authenticated = true;
      this.userSessions.set(socket.id, userSession);

      console.log(`[DEBUG] Call room info:`, {
        id: callRoom.id,
        callerId: callRoom.callerId,
        receiverId: callRoom.receiverId,
        callerUsername: callRoom.callerUsername,
        receiverUsername: callRoom.receiverUsername,
        status: callRoom.status,
        participants: Array.from(callRoom.participants)
      });

      console.log(`[DEBUG] Current user session:`, {
        userId: userSession.userId,
        username: userSession.username
      });

      const callerId = String(callRoom.callerId);
      const currentUserId = String(userSession.userId);

      let callerFound = false;
      let callerSocketConnected = false;

      for (let [socketId, session] of this.userSessions.entries()) {
        const sessionUserId = String(session.userId);
        if (sessionUserId === callerId) {
          callerFound = true;
          const callerSocket = this.io.sockets.sockets.get(socketId);
          if (callerSocket) {
            callerSocketConnected = true;
            const answerData = {
              callRoomId,
              answererId: userSession.userId,
              answererUsername: userSession.username,
              timestamp: Date.now()
            };

            callerSocket.emit('call_answered', answerData);
            console.log(`[SUCCESS] call_answered event sent successfully to ${session.username || 'Anonymous'}`);
          } else {
            console.log(`[WARNING] Caller socket ${socketId} exists in userSessions but not in connected sockets`);
          }
          break;
        }
      }

      if (!callerFound) {
        console.log(`[ERROR] Caller with userId ${callerId} not found in user sessions`);
      } else if (!callerSocketConnected) {
        console.log(`[ERROR] Caller found in sessions but socket is disconnected`);
      }

      if (!callerFound || !callerSocketConnected) {
        console.log(`[DEBUG] Fallback: Searching caller in all connected sockets...`);
        for (let [socketId, connectedSocket] of this.io.sockets.sockets) {
          const session = this.userSessions.get(socketId);
          if (session && String(session.userId) === callerId) {
            console.log(`[DEBUG] Found caller in connected sockets: ${socketId}`);
            const answerData = {
              callRoomId,
              answererId: userSession.userId,
              answererUsername: userSession.username,
              timestamp: Date.now()
            };

            connectedSocket.emit('call_answered', answerData);
            console.log(`[FALLBACK SUCCESS] call_answered sent via fallback method`);
            break;
          }
        }
      }

      console.log(`Cuộc gọi ${callRoomId} được trả lời bởi ${userSession.username || 'Anonymous'}`);

    } catch (error) {
      logger.error(`Error handling call_answer:`, error);
      socket.emit('error', { message: 'Failed to answer call' });
    }
  }

  handleCallReject(socket, data) {
    try {
      console.log(`[Socket RECV] call_reject from ${socket.id}: ${JSON.stringify(data)}`);
      const { callRoomId, token } = data;

      if (!token) {
        socket.emit('error', { message: 'Authentication token required' });
        return;
      }

      const decoded = this.verifyToken(socket, token);
      if (!decoded) return;

      const userSession = this.userSessions.get(socket.id);
      if (!userSession) {
        socket.emit('error', { message: 'User session not found' });
        return;
      }

      const callRoom = this.callRooms.get(callRoomId);
      if (!callRoom) {
        socket.emit('error', { message: 'Call room not found or expired' });
        return;
      }

      // Check if user is the receiver
      if (String(decoded.id) !== String(callRoom.receiverId)) {
        socket.emit('error', {
          message: 'You are not authorized to reject this call',
          code: 'FORBIDDEN'
        });
        return;
      }

      // Update user session
      userSession.userId = decoded.id;
      userSession.username = decoded.userName;
      userSession.authenticated = true;

      console.log(`[DEBUG] Reject call validation:`, {
        callRoomId,
        receiverId: callRoom.receiverId,
        currentUserId: userSession.userId,
        isAuthorized: String(userSession.userId) === String(callRoom.receiverId)
      });

      for (let [socketId, session] of this.userSessions.entries()) {
        const sessionUserId = String(session.userId);
        if (sessionUserId === String(callRoom.callerId)) {
          const callerSocket = this.io.sockets.sockets.get(socketId);
          if (callerSocket) {
            callerSocket.emit('call_rejected', {
              callRoomId,
              rejecterId: userSession.userId,
              rejecterUsername: userSession.username,
              timestamp: Date.now()
            });
            console.log(`Call rejection notification sent to caller ${session.username}`);
          }
          break;
        }
      }

      this.closeCallRoom(callRoomId, 'rejected');

      console.log(`Call ${callRoomId} rejected by ${userSession.username}`);
    } catch (error) {
      logger.error(`Error handling call_reject:`, error);
      socket.emit('error', { message: 'Failed to reject call' });
    }
  }

  handleCallEnd(socket, data) {
    try {
      console.log(`[Socket RECV] call_end from ${socket.id}: ${JSON.stringify(data)}`);
      const { callRoomId, token } = data;

      if (!token) {
        socket.emit('error', { message: 'Authentication token required' });
        return;
      }

      const decoded = this.verifyToken(socket, token);
      if (!decoded) return;

      const userSession = this.userSessions.get(socket.id);
      if (!userSession) {
        socket.emit('error', { message: 'User session not found' });
        return;
      }

      const callRoom = this.callRooms.get(callRoomId);
      if (!callRoom) {
        socket.emit('error', { message: 'Call room not found' });
        return;
      }

      // Check if user is caller or receiver
      const isCaller = String(decoded.id) === String(callRoom.callerId);
      const isReceiver = String(decoded.id) === String(callRoom.receiverId);
      const isParticipant = callRoom.participants.has(socket.id);

      if (!isCaller && !isReceiver && !isParticipant) {
        socket.emit('error', {
          message: 'You are not authorized to end this call',
          code: 'FORBIDDEN'
        });
        return;
      }

      // Update user session
      userSession.userId = decoded.id;
      userSession.username = decoded.userName;
      userSession.authenticated = true;

      this.io.to(callRoomId).emit('call_ended', {
        callRoomId,
        endedBy: userSession.userId,
        endedByUsername: userSession.username,
        timestamp: Date.now()
      });

      this.closeCallRoom(callRoomId, 'ended');

      console.log(`Call ${callRoomId} ended by ${userSession.username}`);
    } catch (error) {
      logger.error(`Error handling call_end:`, error);
      socket.emit('error', { message: 'Failed to end call' });
    }
  }

  leaveCallRoom(socket, callRoomId) {
    const userSession = this.userSessions.get(socket.id);
    const callRoom = this.callRooms.get(callRoomId);

    if (!callRoom || !userSession) return;

    socket.leave(callRoomId);
    callRoom.participants.delete(socket.id);

    // Clean up không cần gì cả

    if (userSession.callRooms) {
      userSession.callRooms.delete(callRoomId);
    }

    socket.emit('call_room_left', {
      callRoomId,
      timestamp: Date.now()
    });

    socket.to(callRoomId).emit('user_left_call', {
      callRoomId,
      userId: userSession.userId,
      username: userSession.username,
      participants: callRoom.participants.size,
      timestamp: Date.now()
    });

    if (callRoom.participants.size === 0) {
      this.closeCallRoom(callRoomId, 'empty');
    }
  }

  closeCallRoom(callRoomId, reason) {
    const callRoom = this.callRooms.get(callRoomId);
    if (!callRoom) return;

    // Remove all participants from the room
    for (const socketId of callRoom.participants) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.leave(callRoomId);

        const userSession = this.userSessions.get(socketId);
        if (userSession && userSession.callRooms) {
          userSession.callRooms.delete(callRoomId);
        }
      }
    }

    this.callRooms.delete(callRoomId);
    console.log(`Call room ${callRoomId} closed: ${reason}`);
  }

  handleDisconnect(socket) {
    try {
      const session = this.userSessions.get(socket.id);
      if (!session) return;

      for (const [roomId, room] of this.callRooms.entries()) {
        if (room.participants.has(socket.id)) {
          room.participants.delete(socket.id);
          
          // Clean up không cần gì cả

          if (room.participants.size === 0) {
            this.cleanupCallRoom(roomId);
          } else if (room.status === 'active') {
            room.status = 'ended';
            this.io.to(roomId).emit('call_ended', {
              callRoomId: roomId,
              status: 'ended',
              reason: 'participant_disconnected',
              timestamp: Date.now()
            });
            this.cleanupCallRoom(roomId);
          }
        }
      }
    } catch (error) {
      logger.error('Error in call disconnect cleanup:', error);
    }
  }

  cleanupCallRoom(callRoomId) {
    try {
      const room = this.callRooms.get(callRoomId);
      if (!room) return;

      for (const socketId of room.participants) {
        const s = this.io.sockets.sockets.get(socketId);
        if (s) s.leave(callRoomId);
      }

      this.callRooms.delete(callRoomId);
      logger.info(`Call room cleaned up: ${callRoomId}`);
    } catch (error) {
      logger.error('Error cleaning up call room:', error);
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

  getCallRoomInfo(callRoomId) {
    const callRoom = this.callRooms.get(callRoomId);
    return callRoom ? {
      callRoomId,
      participants: Array.from(callRoom.participants),
      status: callRoom.status
    } : null;
  }
}

module.exports = CallHandler;