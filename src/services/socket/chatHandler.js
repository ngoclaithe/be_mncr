const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

class ChatHandler {
    constructor(webSocketService) {
        this.wsService = webSocketService;
        this.io = webSocketService.io;
        this.rooms = webSocketService.rooms;
        this.userSessions = webSocketService.userSessions;
        this.streamChats = new Map();
        this.directMessages = new Map();
        this.callRooms = new Map();
    }

    setupHandlers(socket) {
        socket.on('chat_room', (data) => {
            this.handleChatMessage(socket, data);
        });

        socket.on('join_stream_chat', (data) => {
            this.handleJoinStreamChat(socket, data);
        });

        socket.on('leave_stream_chat', (data) => {
            this.handleLeaveStreamChat(socket, data);
        });

        socket.on('chat_message', (data) => {
            this.handleStreamChatMessage(socket, data);
        });

        socket.on('direct_message', (data) => {
            this.handleDirectMessage(socket, data);
        });

        socket.on('send_stream', (data) => {
            this.handleSendStream(socket, data);
        });

        socket.on('disconnect', () => {
            this.handleDisconnect(socket);
        });
    }

    handleChatMessage(socket, data) {
        try {
            console.log(`[Socket RECV] chat_room from ${socket.id}: ${JSON.stringify(data)}`);
            const { roomId, message, userId, username, timestamp } = data;

            const userSession = this.userSessions.get(socket.id);
            if (!userSession || userSession.currentRoom !== roomId) {
                socket.emit('error', { message: 'You must join the room first' });
                return;
            }

            if (!message || message.trim().length === 0) {
                socket.emit('error', { message: 'Message cannot be empty' });
                return;
            }

            const room = this.rooms.get(roomId);
            if (room) {
                room.lastActivity = Date.now();
            }

            this.io.to(`stream_${roomId}`).emit('new_chat_message', {
                messageId: uuidv4(),
                userId,
                username,
                message: message.trim(),
                timestamp: timestamp || Date.now(),
                roomId
            });

            console.log(`Chat message from ${username || 'Anonymous'} in room ${roomId}: ${message.substring(0, 50)}...`);
        } catch (error) {
            logger.error(`Error handling chat_room:`, error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    }

    handleJoinStreamChat(socket, data) {
        try {
            console.log(`[Socket RECV] join_stream_chat from ${socket.id}: ${JSON.stringify(data)}`);
            const { streamId } = data;
            const userSession = this.userSessions.get(socket.id);
            const username = userSession.username || 'Anonymous';

            if (!userSession) {
                socket.emit('error', { message: 'User session not found' });
                return;
            }

            if (!streamId) {
                socket.emit('error', { message: 'StreamId is required' });
                return;
            }

            socket.join(`stream_chat_${streamId}`);

            if (!userSession.streamChats) {
                userSession.streamChats = new Set();
            }
            userSession.streamChats.add(streamId);

            if (!this.streamChats.has(streamId)) {
                this.streamChats.set(streamId, {
                    users: new Set(),
                    messageCount: 0,
                    createdAt: Date.now()
                });
            }

            const streamChat = this.streamChats.get(streamId);
            streamChat.users.add(socket.id);

            socket.emit('stream_chat_joined', {
                streamId,
                userCount: streamChat.users.size,
                timestamp: Date.now()
            });

            socket.to(`stream_chat_${streamId}`).emit('user_joined_stream_chat', {
                streamId,
                userId: userSession.userId,
                username: username,
                userCount: streamChat.users.size,
                timestamp: Date.now()
            });

            console.log(`User ${username} joined stream chat ${streamId}`);
        } catch (error) {
            logger.error(`Error handling join_stream_chat:`, error);
            socket.emit('error', { message: 'Failed to join stream chat' });
        }
    }

    handleLeaveStreamChat(socket, data) {
        try {
            console.log(`[Socket RECV] leave_stream_chat from ${socket.id}: ${JSON.stringify(data)}`);
            const { streamId } = data;
            const userSession = this.userSessions.get(socket.id);
            const username = userSession.username || 'Anonymous';

            if (!userSession) {
                socket.emit('error', { message: 'User session not found' });
                return;
            }

            if (!streamId) {
                socket.emit('error', { message: 'StreamId is required' });
                return;
            }

            socket.leave(`stream_chat_${streamId}`);

            if (userSession.streamChats) {
                userSession.streamChats.delete(streamId);
            }

            const streamChat = this.streamChats.get(streamId);
            if (streamChat) {
                streamChat.users.delete(socket.id);

                if (streamChat.users.size === 0) {
                    this.streamChats.delete(streamId);
                }
            }

            socket.emit('stream_chat_left', {
                streamId,
                timestamp: Date.now()
            });

            if (streamChat && streamChat.users.size > 0) {
                socket.to(`stream_chat_${streamId}`).emit('user_left_stream_chat', {
                    streamId,
                    userId: userSession.userId,
                    username: username,
                    userCount: streamChat.users.size,
                    timestamp: Date.now()
                });
            }

            console.log(`User ${username} left stream chat ${streamId}`);
        } catch (error) {
            logger.error(`Error handling leave_stream_chat:`, error);
            socket.emit('error', { message: 'Failed to leave stream chat' });
        }
    }

handleStreamChatMessage(socket, data) {
    try {
        console.log(`[Socket RECV] chat_message from ${socket.id}: ${JSON.stringify(data)}`);
        const { streamId, userId, username, displayName, message, timestamp, avatar, type } = data;
        const userSession = this.userSessions.get(socket.id);

        if (!userSession) {
            socket.emit('error', { message: 'User session not found' });
            return;
        }

        if (!streamId || !message) {
            socket.emit('error', { message: 'StreamId and message are required' });
            return;
        }

        const trimmedMessage = message.trim();
        if (!trimmedMessage) {
            socket.emit('error', { message: 'Message cannot be empty' });
            return;
        }

        if (!userSession.streamChats || !userSession.streamChats.has(streamId)) {
            socket.emit('error', { message: 'You must join the stream chat first' });
            return;
        }

        const streamChat = this.streamChats.get(streamId);
        if (!streamChat) {
            socket.emit('error', { message: 'Stream chat not found' });
            return;
        }

        // Xác định loại tin nhắn, mặc định là 'message' nếu không có type
        const messageType = type || 'message';

        const chatMessage = {
            messageId: uuidv4(),
            streamId,
            userId,
            username,
            displayName,
            avatar,
            message: trimmedMessage,
            timestamp: timestamp || new Date().toISOString(),
            type: messageType
        };

        streamChat.messageCount++;

        // Emit tin nhắn đến tất cả users trong stream chat
        this.io.to(`stream_chat_${streamId}`).emit('stream_chat_message', chatMessage);
        
        // Log với thông tin chi tiết hơn về loại tin nhắn
        const logMessage = messageType === 'gift' 
            ? `Gift message from ${username || 'Anonymous'} in stream ${streamId}: ${trimmedMessage}`
            : `Stream chat message from ${username || 'Anonymous'} in stream ${streamId}: ${trimmedMessage}`;
        
        console.log(`${logMessage} - Type: ${messageType}`);
        
        if (messageType === 'gift') {
            console.log(`Gift processed: ${trimmedMessage} from user ${userId}`);
        }

    } catch (error) {
        console.error(`Error handling chat_message:`, error);
        socket.emit('error', { message: 'Failed to process chat message' });
    }
}
    handleDirectMessage(socket, data) {
        try {
            console.log(`[Socket RECV] direct_message from ${socket.id}: ${JSON.stringify(data)}`);
            const { recipientId, message } = data;
            const userSession = this.userSessions.get(socket.id);
            const senderUsername = userSession.username || 'Anonymous';

            if (!userSession) {
                socket.emit('error', { message: 'User session not found' });
                return;
            }

            if (!recipientId || !message) {
                socket.emit('error', { message: 'RecipientId and message are required' });
                return;
            }

            if (!message.trim()) {
                socket.emit('error', { message: 'Message cannot be empty' });
                return;
            }

            let recipientSocket = null;
            let recipientSession = null;

            for (let [socketId, session] of this.userSessions.entries()) {
                if (String(session.userId) === String(recipientId)) {
                    recipientSocket = this.io.sockets.sockets.get(socketId);
                    recipientSession = session;
                    break;
                }
            }

            if (!recipientSocket || !recipientSession) {
                socket.emit('error', { message: 'Recipient not found or offline' });
                return;
            }

            const directMessage = {
                messageId: uuidv4(),
                senderId: userSession.userId,
                senderUsername: senderUsername,
                recipientId: recipientId,
                recipientUsername: recipientSession.username,
                message: message.trim(),
                timestamp: Date.now()
            };

            recipientSocket.emit('direct_message_received', directMessage);

            socket.emit('direct_message_sent', {
                messageId: directMessage.messageId,
                recipientId,
                recipientUsername: recipientSession.username,
                message: message.trim(),
                timestamp: directMessage.timestamp
            });

            const conversationKey = [userSession.userId, recipientId].sort().join('_');
            if (!this.directMessages.has(conversationKey)) {
                this.directMessages.set(conversationKey, []);
            }
            this.directMessages.get(conversationKey).push(directMessage);

            console.log(`Direct message from ${senderUsername} to ${recipientSession.username}`);
        } catch (error) {
            logger.error(`Error handling direct_message:`, error);
            socket.emit('error', { message: 'Failed to send direct message' });
        }
    }

    handleSendStream(socket, data) {
        try {
            const { callRoomId, streamData, streamType } = data;
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

            if (!callRoom.participants.has(socket.id)) {
                socket.emit('error', { message: 'You are not in this call room' });
                return;
            }

            socket.to(callRoomId).emit('receive_stream', {
                callRoomId,
                streamData,
                streamType,
                fromUserId: userSession.userId,
                fromUsername: userSession.username,
                timestamp: Date.now()
            });

        } catch (error) {
            logger.error(`Error handling send_stream:`, error);
            socket.emit('error', { message: 'Failed to send stream' });
        }
    }

    closeCallRoom(callRoomId, reason = 'unknown') {
        try {
            const callRoom = this.callRooms.get(callRoomId);
            if (!callRoom) return;

            this.io.to(callRoomId).emit('call_room_closed', {
                callRoomId,
                reason,
                timestamp: Date.now()
            });

            for (let socketId of callRoom.participants) {
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

            console.log(`Call room ${callRoomId} closed due to: ${reason}`);
        } catch (error) {
            logger.error(`Error closing call room ${callRoomId}:`, error);
        }
    }

    handleDisconnect(socket) {
        try {
            const userSession = this.userSessions.get(socket.id);
            if (!userSession) return;
            const username = userSession.username || 'Anonymous';

            if (userSession.streamChats) {
                for (let streamId of userSession.streamChats) {
                    const streamChat = this.streamChats.get(streamId);
                    if (streamChat) {
                        streamChat.users.delete(socket.id);

                        socket.to(`stream_chat_${streamId}`).emit('user_left_stream_chat', {
                            streamId,
                            userId: userSession.userId,
                            username: username,
                            userCount: streamChat.users.size,
                            timestamp: Date.now()
                        });

                        if (streamChat.users.size === 0) {
                            this.streamChats.delete(streamId);
                        }
                    }
                }
            }

            if (userSession.callRooms) {
                for (let callRoomId of userSession.callRooms) {
                    this.leaveCallRoom(socket, callRoomId);
                }
            }

            console.log(`User ${username} disconnected, cleaned up chat and call sessions`);
        } catch (error) {
            logger.error(`Error handling disconnect cleanup:`, error);
        }
    }
    leaveCallRoom(socket, callRoomId) {
        try {
            const userSession = this.userSessions.get(socket.id);
            if (!userSession) return;

            const callRoom = this.callRooms.get(callRoomId);
            if (!callRoom) return;

            // Rời khỏi room
            socket.leave(callRoomId);
            callRoom.participants.delete(socket.id);

            // Xóa khỏi user session
            if (userSession.callRooms) {
                userSession.callRooms.delete(callRoomId);
            }

            // Thông báo cho các participants khác
            socket.to(callRoomId).emit('user_left_call', {
                callRoomId,
                userId: userSession.userId,
                username: userSession.username,
                participantCount: callRoom.participants.size,
                timestamp: Date.now()
            });

            // Nếu không còn ai thì xóa call room
            if (callRoom.participants.size === 0) {
                this.closeCallRoom(callRoomId, 'all_participants_left');
            }

            console.log(`User ${userSession.username} left call room ${callRoomId}`);
        } catch (error) {
            logger.error(`Error leaving call room:`, error);
        }
    }

    getStreamChatInfo(streamId) {
        const streamChat = this.streamChats.get(streamId);
        if (!streamChat) return null;

        return {
            streamId,
            userCount: streamChat.users.size,
            messageCount: streamChat.messageCount,
            createdAt: streamChat.createdAt
        };
    }

    getAllActiveStreamChats() {
        const activeChats = [];
        for (let [streamId, chat] of this.streamChats.entries()) {
            activeChats.push({
                streamId,
                userCount: chat.users.size,
                messageCount: chat.messageCount,
                createdAt: chat.createdAt
            });
        }
        return activeChats;
    }

    getCallRoomInfo(callRoomId) {
        const callRoom = this.callRooms.get(callRoomId);
        if (!callRoom) return null;

        return {
            id: callRoom.id,
            conversationId: callRoom.conversationId,
            callType: callRoom.callType,
            status: callRoom.status,
            participants: callRoom.participants.size,
            callerId: callRoom.callerId,
            receiverId: callRoom.receiverId,
            createdAt: callRoom.createdAt
        };
    }

    getAllActiveCallRooms() {
        const activeCalls = [];
        for (let [callRoomId, callRoom] of this.callRooms.entries()) {
            activeCalls.push({
                id: callRoom.id,
                conversationId: callRoom.conversationId,
                callType: callRoom.callType,
                status: callRoom.status,
                participants: callRoom.participants.size,
                createdAt: callRoom.createdAt
            });
        }
        return activeCalls;
    }
}

module.exports = ChatHandler;