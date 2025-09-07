require('dotenv').config();
const express = require('express');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { connectDB, sequelize } = require('./config/database');
const { initializeRedis } = require('./config/redis');
const config = require('./config');
const logger = require('./utils/logger');
// const { errorHandler, notFound } = require('./middleware/error.middleware');
const mqttService = require('./services/mqtt/mqtt');

const app = express();
const httpServer = createServer(app);

app.use((req, res, next) => {
  res.header('Vary', 'Origin');
  next();
});

app.use(cors(config.cors));

const io = new Server(httpServer, {
  cors: config.websocket.cors,
  path: config.websocket.path,
  transports: config.websocket.transports,
  pingTimeout: config.websocket.pingTimeout,
  pingInterval: config.websocket.pingInterval,
  allowEIO3: config.websocket.allowEIO3,
  maxHttpBufferSize: config.websocket.maxHttpBufferSize,
  allowUpgrades: config.websocket.allowUpgrades,
  perMessageDeflate: config.websocket.perMessageDeflate
});

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false,
}));

app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

app.use(cookieParser());

// Phục vụ các file HLS (HTTP Live Streaming)
const hlsStreamPath = path.join(__dirname, '..', 'public', 'streams');
if (!fs.existsSync(hlsStreamPath)) {
  fs.mkdirSync(hlsStreamPath, { recursive: true });
  logger.info(`Created HLS stream directory at: ${hlsStreamPath}`);
}
app.use('/api/v2/streams', cors(), express.static(hlsStreamPath, {
  maxAge: 0, 
  etag: false,
  lastModified: false,
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (path.extname(filePath) === '.m3u8') {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    } else if (path.extname(filePath) === '.ts') {
      res.setHeader('Content-Type', 'video/mp2t');
    }
  }
}));

const WebSocketService = require('./services/socket/index');
const webSocketService = new WebSocketService(io);
webSocketService.initialize();

io.engine.on('connection_error', (err) => {
  logger.error('Socket.IO connection error:', err);
});

io.on('connection', (socket) => {
  console.log('🔌 New socket connection:');
  console.log('   Socket ID:', socket.id);
  console.log('   Connection URL:', socket.request.url);
  console.log('   Headers:', JSON.stringify(socket.request.headers, null, 2));
  
  socket.on('disconnect', (reason) => {
    console.log('❌ Socket disconnected:', socket.id, 'Reason:', reason);
  });
});

app.use((req, res, next) => {
  try {
    req.io = io;
    req.app.set('webSocketService', webSocketService);
    next();
  } catch (error) {
    logger.error('Error setting up socket.io in middleware:', error);
    next();
  }
});

async function initApp() {
  try {
    await mqttService.connect();
    console.log('✅ MQTT connected successfully!');
    
  } catch (error) {
    console.error('❌ Failed to initialize MQTT:', error);
    process.exit(1);
  }
}

initApp();

let authRoutes,
  kycRoutes,
  postRoutes,
  creatorRoutes,
  storyRoutes,
  followRoutes,
  commentRoutes,
  reactionRoutes,
  streamRoutes,
  userFollowRoutes,
  infoPaymentRoutes,
  transactionRoutes,
  walletRoutes,
  streamPackageRoutes,
  creatorPackageSubscriptionRoutes,
  messageRoutes,
  conversationRoutes,
  cloudinaryRoutes,
  chatRoutes,
  giftRoutes,
  bookingRoutes,
  reviewRoutes,
  searchRoutes,
  reportRoutes
;

try {
  authRoutes = require('./routes/auth/authRoutes');
  kycRoutes = require('./routes/auth/kycRoutes');
  followRoutes = require('./routes/social/followRoutes');
  storyRoutes = require('./routes/social/storyRoutes');
  creatorRoutes = require('./routes/creator/creatorRoutes');
  reactionRoutes = require('./routes/social/reactionRoutes');
  postRoutes = require('./routes/social/postRoutes');
  commentRoutes = require('./routes/social/commentRoutes');
  streamRoutes = require('./routes/streaming/streamRoutes');
  userFollowRoutes = require('./routes/user/followRoutes');
  infoPaymentRoutes = require('./routes/payment/infoPaymentRoutes');
  transactionRoutes = require('./routes/payment/transactionRoutes');
  walletRoutes = require('./routes/wallet/walletRoutes');
  streamPackageRoutes = require('./routes/package/streamPackageRoutes');
  creatorPackageSubscriptionRoutes = require('./routes/package/creatorPackageSubscriptionRoutes');
  conversationRoutes = require('./routes/chatprivate/conversationRoutes');
  messageRoutes = require('./routes/chatprivate/messageRoutes');
  cloudinaryRoutes = require('./routes/upload/cloudinaryRoutes');
  chatRoutes = require('./routes/streaming/chatRoutes');
  giftRoutes = require('./routes/streaming/giftRoutes');
  bookingRoutes = require('./routes/booking/bookingRoutes');
  reviewRoutes = require('./routes/booking/reviewRoutes');
  searchRoutes = require('./routes/search/searchRoutes');
  reportRoutes = require('./routes/support/reportRoutes');
} catch (error) {
  logger.error('Error importing routes:', error);
  process.exit(1);
}

// API Routes
app.use('/api/v2/auth', authRoutes);
app.use('/api/v2/kyc', kycRoutes);
app.use('/api/v2/follows', followRoutes);
app.use('/api/v2/stories', storyRoutes);
app.use('/api/v2/creators', creatorRoutes);
app.use('/api/v2/posts', postRoutes);
app.use('/api/v2/comments', commentRoutes);
app.use('/api/v2/reactions', reactionRoutes);
app.use('/api/v2/streams', streamRoutes);
app.use('/api/v2/user-follows', userFollowRoutes);
app.use('/api/v2/info-payments', infoPaymentRoutes);
app.use('/api/v2/transactions', transactionRoutes);
app.use('/api/v2/wallet', walletRoutes);
app.use('/api/v2/stream-packages', streamPackageRoutes);
app.use('/api/v2/subscriptions', creatorPackageSubscriptionRoutes);
app.use('/api/v2/conversations', conversationRoutes);
app.use('/api/v2/messages', messageRoutes);
app.use('/api/v2/cloudinary', cloudinaryRoutes);
app.use('/api/v2/chats', chatRoutes);
app.use('/api/v2/stream-gifts', giftRoutes);
app.use('/api/v2/bookings', bookingRoutes);
app.use('/api/v2/reviews', reviewRoutes);
app.use('/api/v2/search', searchRoutes);
app.use('/api/v2/reports', reportRoutes);

// app.use(notFound);
// app.use(errorHandler);

const startServer = async () => {
  try {

    await connectDB();
    logger.info('Database connected successfully');

    logger.info('Initializing database models...');
    const { initModels } = require('./models');
    const syncSuccess = await initModels();

    if (!syncSuccess) {
      throw new Error('Failed to initialize database models');
    }
    logger.info('Database models initialized successfully');

    // try {
    //   logger.info('Initializing Redis...');
    //   await initializeRedis();
    //   logger.info('Redis initialized successfully');
    // } catch (redisError) {
    //   logger.warn('Redis initialization failed, continuing without Redis:', redisError.message);
    // }

    const server = httpServer.listen(config.port, config.host, () => {
      const serverUrl = `http://${config.host}:${config.port}`;      
      logger.info(`API Documentation: ${serverUrl}/api-docs`);
    });

    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received, starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          io.close();
          logger.info('Socket.IO connections closed');

          await sequelize.close();
          logger.info('Database connections closed');

          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });

      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;

  } catch (error) {
    logger.error(`❌ Failed to start server: ${error.message}`);
    if (error.stack) {
      logger.error(error.stack);
    }
    process.exit(1);
  }
};

process.on('unhandledRejection', (err, promise) => {
  logger.error('🚨 Unhandled Promise Rejection:', err.message);
  logger.error('Promise:', promise);
  if (err.stack) {
    logger.error(err.stack);
  }

  httpServer.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err) => {
  logger.error('🚨 Uncaught Exception:', err.message);
  if (err.stack) {
    logger.error(err.stack);
  }
  process.exit(1);
});

startServer().catch(error => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});

module.exports = app;