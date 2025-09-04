const logger = require('../../utils/logger');
const StreamHandler = require('./streamHandler');
const ChatHandler = require('./chatHandler');
const GiftHandler = require('./giftHandler');
const CallHandler = require('./callHandler');

class WebSocketService {
    constructor(io) {
        this.io = io;
        this.connections = new Map();
        this.rooms = new Map();
        this.userSessions = new Map();
        this.cleanupInterval = null;

        // Initialize handlers
        this.streamHandler = new StreamHandler(this);
        this.chatHandler = new ChatHandler(this);
        this.giftHandler = new GiftHandler(this);
        this.callHandler = new CallHandler(this);
    }

    initialize() {
        this.io.on('connection', (socket) => {
            logger.info(`New WebSocket connection: ${socket.id}`);

            this.connections.set(socket.id, socket);

            this.initializeSocketHandlers(socket);

            socket.on('disconnect', () => {
                logger.info(`Client disconnected: ${socket.id}`);
                this.connections.delete(socket.id);
                this.userSessions.delete(socket.id);
            });
        });

        //    this.setupGeneralCleanupInterval();

        return this.io;
    }

    initializeSocketHandlers(socket) {
        this.userSessions.set(socket.id, {
            socketId: socket.id,
            joinedAt: new Date(),
            lastActive: new Date(),
            clientType: 'unknown',
            currentRoom: null
        });

        // Setup handlers
        this.streamHandler.setupHandlers(socket);
        this.chatHandler.setupHandlers(socket);
        this.giftHandler.setupHandlers(socket);
        this.callHandler.setupHandlers(socket);
        this.setupGlobalHandlers(socket);
    }

    setupGlobalHandlers(socket) {
        socket.on('error', (error) => {
            logger.error(`Socket error (${socket.id}):`, error);
        });

        socket.on('ping', (cb) => {
            if (typeof cb === 'function') {
                cb('pong');
            }
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            const userSession = this.userSessions.get(socket.id);
            if (userSession && userSession.currentRoom) {
                this.streamHandler.handleLeaveRoom(socket, userSession.currentRoom);
            }
        });
    }

    //  setupGeneralCleanupInterval() {
    //    const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
    //    const MAX_INACTIVE_TIME = 2 * 60 * 60 * 1000; // 2 hours

    //    this.cleanupInterval = setInterval(() => {
    //      const now = Date.now();
    //      let roomsCleaned = 0;
    //      let staleConnectionsCleaned = 0;

    //      // Cleanup inactive rooms
    //      for (const [roomId, room] of this.rooms.entries()) {
    //        if (now - room.lastActivity > MAX_INACTIVE_TIME && room.clients.size === 0) {
    //          this.rooms.delete(roomId);
    //          roomsCleaned++;
    //        }
    //      }

    //      // Cleanup stale user sessions
    //      for (const [socketId, session] of this.userSessions.entries()) {
    //        const lastActive = session?.lastActive;
    //        if (
    //          lastActive instanceof Date &&
    //          now - lastActive.getTime() > MAX_INACTIVE_TIME
    //        ) {
    //          if (!this.connections.has(socketId)) {
    //            this.userSessions.delete(socketId);
    //            staleConnectionsCleaned++;
    //          }
    //        }
    //      }

    //      if (roomsCleaned > 0 || staleConnectionsCleaned > 0) {
    //        logger.info(`Cleanup completed: ${roomsCleaned} inactive rooms, ${staleConnectionsCleaned} stale sessions`);
    //      }
    //    }, CLEANUP_INTERVAL);

    //    logger.info('Cleanup interval initialized (1 hour interval)');
    //  }

    /**
     * Get room by ID
     */
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    /**
     * Get all rooms
     */
    getAllRooms() {
        return Array.from(this.rooms.values());
    }

    /**
     * Get active connections count
     */
    getConnectionCount() {
        return this.connections.size;
    }

    /**
     * Get active rooms count
     */
    getRoomCount() {
        return this.rooms.size;
    }

    /**
     * Broadcast to all connected clients in a room
     */
    broadcastToRoom(roomId, event, data) {
        this.io.to(`stream_${roomId}`).emit(event, data);
    }

    /**
     * Send to a specific client
     */
    sendToClient(socketId, event, data) {
        const socket = this.connections.get(socketId);
        if (socket) {
            socket.emit(event, data);
            return true;
        }
        return false;
    }

    /**
     * Clean up all resources
     */
    cleanup() {
        logger.info('Starting WebSocket service cleanup...');

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            logger.info('Cleanup interval cleared');
        }

        this.connections.forEach((socket, socketId) => {
            try {
                socket.disconnect(true);
                logger.info(`Socket ${socketId} disconnected during cleanup`);
            } catch (error) {
                logger.error(`Error disconnecting socket ${socketId}:`, error);
            }
        });

        this.connections.clear();
        this.userSessions.clear();
        this.rooms.clear();

        logger.info('WebSocket service cleanup completed');
    }

    /**
     * Get service health status
     */
    getHealthStatus() {
        return {
            connections: this.connections.size,
            rooms: this.rooms.size,
            userSessions: this.userSessions.size,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = WebSocketService;
