const logger = require('../../utils/logger');

class GiftHandler {
    constructor(webSocketService) {
        this.wsService = webSocketService;
        this.io = webSocketService.io;
        this.rooms = webSocketService.rooms;
        this.userSessions = webSocketService.userSessions;
    }

    setupHandlers(socket) {
        // Xử lý gift trong phòng
        socket.on('gift_room', (data) => {
            this.handleGift(socket, data);
        });
    }

    handleGift(socket, data) {
        try {
            const { roomId, giftType, giftValue, userId, username, targetUserId, message } = data;

            const userSession = this.userSessions.get(socket.id);
            if (!userSession || userSession.currentRoom !== roomId) {
                socket.emit('error', { message: 'You must join the room first' });
                return;
            }

            if (!giftType) {
                socket.emit('error', { message: 'Gift type is required' });
                return;
            }

            // Update room activity
            const room = this.rooms.get(roomId);
            if (room) {
                room.lastActivity = Date.now();
            }

            // Broadcast gift to all users in room
            this.io.to(`stream_${roomId}`).emit('new_gift', {
                giftId: Date.now() + Math.random(), // Simple ID generation
                senderId: userId,
                senderUsername: username,
                targetUserId,
                giftType,
                giftValue: giftValue || 1,
                message: message || '',
                timestamp: Date.now(),
                roomId
            });

            logger.info(`Gift ${giftType} from ${username || 'Anonymous'} in room ${roomId}`);
        } catch (error) {
            logger.error(`Error handling gift_room:`, error);
            socket.emit('error', { message: 'Failed to send gift' });
        }
    }
}

module.exports = GiftHandler;