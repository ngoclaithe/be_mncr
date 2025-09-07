const { sequelize } = require('../config/database');

// Import all models
const User = require('./User');
const Creator = require('./Creator');
const Stream = require('./Stream');
const Chat = require('./Chat');
const Gift = require('./Gift');
const Donation = require('./Donation');
const Wallet = require('./Wallet');
const Transaction = require('./Transaction');
const Subscription = require('./Subscription');
const Booking = require('./Booking');
const Review = require('./Review');
const Follow = require('./Follow');
const Message = require('./Message');
const Notification = require('./Notification');
const Report = require('./Report');
const SupportTicket = require('./SupportTicket');
const KYC = require('./KYC');
const Analytics = require('./Analytics');
const StreamPackage = require('./StreamPackage');
const CreatorPackageSubscription = require('./CreatorPackageSubscription');
const AffiliateCommission = require('./AffiliateCommission');
const Post = require('./Post');
const Comment = require('./Comment');
const Reaction = require('./Reaction');
const Share = require('./Share');
const Story = require('./Story');
const StoryView = require('./StoryView');
const InfoPayment = require('./InfoPayment');
const Admin = require('./Admin');
const Conversation = require('./Conversation');

function setupAssociations() {
  try {

    // ==================== USER RELATIONSHIPS ====================
    try {
      // User có thể có 1 Creator profile
      User.hasOne(Creator, {
        foreignKey: 'userId',
        as: 'creatorProfile'
      });

      // User có 1 ví
      User.hasOne(Wallet, {
        foreignKey: 'userId',
        as: 'wallet'
      });

      // User có 1 KYC
      User.hasOne(KYC, {
        foreignKey: 'userId',
        as: 'kyc'
      });

      // User có nhiều giao dịch (gửi và nhận)
      User.hasMany(Transaction, {
        foreignKey: 'fromUserId',
        as: 'sentTransactions'
      });

      User.hasMany(Transaction, {
        foreignKey: 'toUserId',
        as: 'receivedTransactions'
      });

      // User có nhiều booking
      User.hasMany(Booking, {
        foreignKey: 'userId',
        as: 'bookings'
      });

      // User có nhiều review
      User.hasMany(Review, {
        foreignKey: 'userId',
        as: 'reviews'
      });

      // User theo dõi nhiều creator
      User.hasMany(Follow, {
        foreignKey: 'followerId',
        as: 'following'
      });

      // User có nhiều tin nhắn (gửi và nhận)
      User.hasMany(Message, {
        foreignKey: 'senderId',
        as: 'sentMessages'
      });

      User.hasMany(Message, {
        foreignKey: 'receiverId',
        as: 'receivedMessages'
      });

      // User có nhiều notification
      User.hasMany(Notification, {
        foreignKey: 'userId',
        as: 'notifications'
      });

      // User có nhiều report (tạo và bị báo cáo)
      User.hasMany(Report, {
        foreignKey: 'reporterId',
        as: 'reportsCreated'
      });

      User.hasMany(Report, {
        foreignKey: 'reportedUserId',
        as: 'reportsReceived'
      });

      // User có nhiều support ticket
      User.hasMany(SupportTicket, {
        foreignKey: 'userId',
        as: 'supportTickets'
      });

      // User có nhiều analytics
      User.hasMany(Analytics, {
        foreignKey: 'userId',
        as: 'analytics'
      });

      // User tham gia affiliate
      User.hasMany(AffiliateCommission, {
        foreignKey: 'affiliateUserId',
        as: 'commissions'
      });

      User.hasMany(AffiliateCommission, {
        foreignKey: 'referredUserId',
        as: 'referralCommissions'
      });

      // User tự refer lẫn nhau
      User.hasMany(User, {
        foreignKey: 'referredBy',
        as: 'referrals'
      });

      User.belongsTo(User, {
        foreignKey: 'referredBy',
        as: 'referrer'
      });

      User.hasOne(Admin, {
        foreignKey: 'userId',
        as: 'adminProfile'
      });

      User.hasMany(Conversation, {
        foreignKey: 'senderId',
        as: 'conversationsAsSender'
      });

      User.hasMany(Conversation, {
        foreignKey: 'receiverId',
        as: 'conversationsAsReceiver'
      });

    } catch (error) {
      console.error('Error setting up User relationships:', error.message);
      throw error;
    }

    // ==================== SOCIAL FEATURES ====================
    try {
      // User có nhiều bài đăng
      User.hasMany(Post, {
        foreignKey: 'userId',
        as: 'posts'
      });

      // User có nhiều comment
      User.hasMany(Comment, {
        foreignKey: 'userId',
        as: 'comments'
      });

      // User có nhiều reaction
      User.hasMany(Reaction, {
        foreignKey: 'userId',
        as: 'reactions'
      });

      // User có nhiều share
      User.hasMany(Share, {
        foreignKey: 'userId',
        as: 'shares'
      });

      // User có nhiều story
      User.hasMany(Story, {
        foreignKey: 'userId',
        as: 'stories'
      });

      // User xem nhiều story
      User.hasMany(StoryView, {
        foreignKey: 'viewerId',
        as: 'storyViews'
      });

    } catch (error) {
      console.error('Error setting up User social relationships:', error.message);
      throw error;
    }

    // ==================== CREATOR RELATIONSHIPS ====================
    try {
      // Creator thuộc về 1 User
      Creator.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user'
      });

      // Creator có nhiều stream
      Creator.hasMany(Stream, {
        foreignKey: 'creatorId',
        as: 'streams'
      });

      // Creator có nhiều booking
      Creator.hasMany(Booking, {
        foreignKey: 'creatorId',
        as: 'bookings'
      });

      // Creator có nhiều follower
      Creator.hasMany(Follow, {
        foreignKey: 'creatorId',
        as: 'followers'
      });

      // Creator có nhiều subscription
      Creator.hasMany(Subscription, {
        foreignKey: 'creatorId',
        as: 'subscriptions'
      });

      // Creator có nhiều analytics
      Creator.hasMany(Analytics, {
        foreignKey: 'creatorId',
        as: 'analytics'
      });

      // Creator có nhiều package subscription
      Creator.hasMany(CreatorPackageSubscription, {
        foreignKey: 'creatorId',
        as: 'packageSubscriptions'
      });

      // Creator có thể đăng post
      Creator.hasMany(Post, {
        foreignKey: 'creatorId',
        as: 'posts'
      });

      // Creator có thể đăng story
      Creator.hasMany(Story, {
        foreignKey: 'creatorId',
        as: 'stories'
      });

    } catch (error) {
      console.error('Error setting up Creator relationships:', error.message);
      throw error;
    }

    // ==================== STREAM RELATIONSHIPS ====================
    try {
      // Stream thuộc về 1 Creator
      Stream.belongsTo(Creator, {
        foreignKey: 'creatorId',
        as: 'creator'
      });

      // Stream có nhiều chat
      Stream.hasMany(Chat, {
        foreignKey: 'streamId',
        as: 'chats'
      });

      // Stream có nhiều donation
      Stream.hasMany(Donation, {
        foreignKey: 'streamId',
        as: 'donations'
      });

      // Stream có nhiều transaction
      Stream.hasMany(Transaction, {
        foreignKey: 'streamId',
        as: 'transactions'
      });

    } catch (error) {
      console.error('Error setting up Stream relationships:', error.message);
      throw error;
    }

    // ==================== BOOKING RELATIONSHIPS ====================
    try {
      // Booking thuộc về 1 User (client)
      Booking.belongsTo(User, {
        foreignKey: 'userId',
        as: 'client'
      });

      // Booking thuộc về 1 Creator
      Booking.belongsTo(Creator, {
        foreignKey: 'creatorId',
        as: 'creator'
      });

      // Booking có nhiều review
      Booking.hasMany(Review, {
        foreignKey: 'bookingId',
        as: 'reviews'
      });

      // Booking có nhiều transaction
      Booking.hasMany(Transaction, {
        foreignKey: 'bookingId',
        as: 'transactions'
      });

    } catch (error) {
      console.error('Error setting up Booking relationships:', error.message);
      throw error;
    }

    // ==================== TRANSACTION RELATIONSHIPS ====================
    try {
      // Transaction từ User gửi
      Transaction.belongsTo(User, {
        foreignKey: 'fromUserId',
        as: 'fromUser'
      });

      // Transaction đến User nhận
      Transaction.belongsTo(User, {
        foreignKey: 'toUserId',
        as: 'toUser'
      });

      // Transaction liên quan đến booking
      Transaction.belongsTo(Booking, {
        foreignKey: 'bookingId',
        as: 'booking'
      });

      // Transaction liên quan đến stream
      Transaction.belongsTo(Stream, {
        foreignKey: 'streamId',
        as: 'stream'
      });

      // Transaction liên quan đến subscription
      Transaction.belongsTo(Subscription, {
        foreignKey: 'subscriptionId',
        as: 'subscription'
      });

      // Transaction liên quan đến InfoPayment (cho deposit)
      Transaction.belongsTo(InfoPayment, {
        foreignKey: 'infoPaymentId',
        as: 'infoPayment'
      });

      // Transaction có thể có parent transaction (cho commission/refund)
      Transaction.belongsTo(Transaction, {
        foreignKey: 'parentTransactionId',
        as: 'parentTransaction'
      });

      Transaction.hasMany(Transaction, {
        foreignKey: 'parentTransactionId',
        as: 'childTransactions'
      });

      // Transaction được process bởi admin
      Transaction.belongsTo(User, {
        foreignKey: 'processedBy',
        as: 'processor'
      });

      // Transaction có affiliate commission
      Transaction.hasMany(AffiliateCommission, {
        foreignKey: 'transactionId',
        as: 'affiliateCommissions'
      });

    } catch (error) {
      console.error('Error setting up Transaction relationships:', error.message);
      throw error;
    }

    // ==================== FOLLOW RELATIONSHIPS ====================
    try {
      // Follow thuộc về User (follower)
      Follow.belongsTo(User, {
        foreignKey: 'followerId',
        as: 'follower'
      });

      // Follow thuộc về Creator (được theo dõi)
      Follow.belongsTo(Creator, {
        foreignKey: 'creatorId',
        as: 'creator'
      });

    } catch (error) {
      console.error('Error setting up Follow relationships:', error.message);
      throw error;
    }

    // ==================== REVIEW RELATIONSHIPS ====================
    try {
      // Review thuộc về Booking
      Review.belongsTo(Booking, {
        foreignKey: 'bookingId',
        as: 'booking'
      });

      // Review thuộc về User
      Review.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user'
      });

      // Review thuộc về Creator
      Review.belongsTo(Creator, {
        foreignKey: 'creatorId',
        as: 'creator'
      });

    } catch (error) {
      console.error('Error setting up Review relationships:', error.message);
      throw error;
    }

    // ==================== MESSAGE RELATIONSHIPS ====================
    try {
      // Message từ User gửi
      Message.belongsTo(User, {
        foreignKey: 'senderId',
        as: 'sender'
      });

      // Message đến User nhận
      Message.belongsTo(User, {
        foreignKey: 'receiverId',
        as: 'receiver'
      });

      Message.belongsTo(Conversation, {
        foreignKey: 'conversationId',
        as: 'conversation'
      });

    } catch (error) {
      console.error('Error setting up Message relationships:', error.message);
      throw error;
    }

    // ==================== CONVERSATION RELATIONSHIPS ====================
    try {
      // Conversation giữa 2 user
      Conversation.belongsTo(User, {
        foreignKey: 'senderId',
        as: 'sender'
      });

      Conversation.belongsTo(User, {
        foreignKey: 'receiverId',
        as: 'receiver'
      });

      // Conversation có nhiều message
      Conversation.hasMany(Message, {
        foreignKey: 'conversationId',
        as: 'messages'
      });

      // Conversation tham chiếu tin nhắn cuối cùng
      Conversation.belongsTo(Message, {
        foreignKey: 'lastMessageId',
        as: 'lastMessage'
      });

    } catch (error) {
      console.error('Error setting up Conversation relationships:', error.message);
      throw error;
    }

    // ==================== CHAT RELATIONSHIPS ====================
    try {
      // Chat thuộc về Stream
      Chat.belongsTo(Stream, {
        foreignKey: 'streamId',
        as: 'stream'
      });

      // Chat thuộc về User (có thể null cho anonymous)
      Chat.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user'
      });

      // Chat bị xóa bởi User (moderator/admin)
      Chat.belongsTo(User, {
        foreignKey: 'deletedBy',
        as: 'deletedByUser'
      });

    } catch (error) {
      console.error('Error setting up Chat relationships:', error.message);
      throw error;
    }

    // ==================== DONATION RELATIONSHIPS ====================
    try {
      // Donation thuộc về Stream
      Donation.belongsTo(Stream, {
        foreignKey: 'streamId',
        as: 'stream'
      });

      // Donation thuộc về User
      Donation.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user'
      });

      // Donation có thể có Gift
      Donation.belongsTo(Gift, {
        foreignKey: 'giftId',
        as: 'gift'
      });

    } catch (error) {
      console.error('Error setting up Donation relationships:', error.message);
      throw error;
    }

    // ==================== GIFT RELATIONSHIPS ====================
    try {
      // Gift có nhiều donation
      Gift.hasMany(Donation, {
        foreignKey: 'giftId',
        as: 'donations'
      });

    } catch (error) {
      console.error('Error setting up Gift relationships:', error.message);
      throw error;
    }

    // ==================== WALLET RELATIONSHIPS ====================
    try {
      // Wallet thuộc về User
      Wallet.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user'
      });

    } catch (error) {
      console.error('Error setting up Wallet relationships:', error.message);
      throw error;
    }

    // ==================== SUBSCRIPTION RELATIONSHIPS ====================
    try {
      // Subscription thuộc về User
      Subscription.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user'
      });

      // Subscription thuộc về Creator
      Subscription.belongsTo(Creator, {
        foreignKey: 'creatorId',
        as: 'creator'
      });

      // Subscription có nhiều transaction
      Subscription.hasMany(Transaction, {
        foreignKey: 'subscriptionId',
        as: 'transactions'
      });

    } catch (error) {
      console.error('Error setting up Subscription relationships:', error.message);
      throw error;
    }

    // ==================== NOTIFICATION RELATIONSHIPS ====================
    try {
      // Notification thuộc về User
      Notification.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user'
      });

    } catch (error) {
      console.error('Error setting up Notification relationships:', error.message);
      throw error;
    }

    // ==================== REPORT RELATIONSHIPS ====================
    try {
      // Report từ User báo cáo
      Report.belongsTo(User, {
        foreignKey: 'reporterId',
        as: 'reporter'
      });

      // Report về User bị báo cáo
      Report.belongsTo(User, {
        foreignKey: 'reportedUserId',
        as: 'reportedUser'
      });

      // Report được xử lý bởi Admin
      Report.belongsTo(User, {
        foreignKey: 'resolvedBy',
        as: 'resolver'
      });

    } catch (error) {
      console.error('Error setting up Report relationships:', error.message);
      throw error;
    }

    // ==================== SUPPORT TICKET RELATIONSHIPS ====================
    try {
      // Support ticket thuộc về User
      SupportTicket.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user'
      });

      // Support ticket được assign cho Admin
      SupportTicket.belongsTo(User, {
        foreignKey: 'assignedTo',
        as: 'assignee'
      });

    } catch (error) {
      console.error('Error setting up SupportTicket relationships:', error.message);
      throw error;
    }

    // ==================== KYC RELATIONSHIPS ====================
    try {
      // KYC thuộc về User
      KYC.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user'
      });

      // KYC được review bởi Admin
      KYC.belongsTo(User, {
        foreignKey: 'reviewedBy',
        as: 'reviewer'
      });

    } catch (error) {
      console.error('Error setting up KYC relationships:', error.message);
      throw error;
    }

    // ==================== ANALYTICS RELATIONSHIPS ====================
    try {
      // Analytics thuộc về User
      Analytics.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user'
      });

      // Analytics thuộc về Creator
      Analytics.belongsTo(Creator, {
        foreignKey: 'creatorId',
        as: 'creator'
      });

    } catch (error) {
      console.error('Error setting up Analytics relationships:', error.message);
      throw error;
    }

    // ==================== PACKAGE RELATIONSHIPS ====================
    try {
      // Creator Package Subscription thuộc về Creator
      CreatorPackageSubscription.belongsTo(Creator, {
        foreignKey: 'creatorId',
        as: 'creator'
      });

      // Creator Package Subscription thuộc về Package
      CreatorPackageSubscription.belongsTo(StreamPackage, {
        foreignKey: 'packageId',
        as: 'package'
      });

      // Stream Package có nhiều subscription
      StreamPackage.hasMany(CreatorPackageSubscription, {
        foreignKey: 'packageId',
        as: 'subscriptions'
      });

    } catch (error) {
      console.error('Error setting up Package relationships:', error.message);
      throw error;
    }

    // ==================== AFFILIATE RELATIONSHIPS ====================
    try {
      // Affiliate Commission thuộc về User (affiliate)
      AffiliateCommission.belongsTo(User, {
        foreignKey: 'affiliateUserId',
        as: 'affiliate'
      });

      // Affiliate Commission thuộc về User (được refer)
      AffiliateCommission.belongsTo(User, {
        foreignKey: 'referredUserId',
        as: 'referredUser'
      });

      // Affiliate Commission thuộc về Transaction
      AffiliateCommission.belongsTo(Transaction, {
        foreignKey: 'transactionId',
        as: 'transaction'
      });

    } catch (error) {
      console.error('Error setting up Affiliate relationships:', error.message);
      throw error;
    }

    // ==================== SOCIAL FEATURES RELATIONSHIPS ====================
    try {
      // POST RELATIONSHIPS
      Post.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user'
      });

      Post.belongsTo(Creator, {
        foreignKey: 'creatorId',
        as: 'creator'
      });

      Post.hasMany(Comment, {
        foreignKey: 'postId',
        as: 'comments'
      });

      Post.hasMany(Reaction, {
        foreignKey: 'targetId',
        scope: { targetType: 'post' },
        as: 'reactions'
      });

      Post.hasMany(Share, {
        foreignKey: 'postId',
        as: 'shares'
      });

    } catch (error) {
      console.error('Error setting up Post relationships:', error.message);
      throw error;
    }

    try {
      // COMMENT RELATIONSHIPS
      Comment.belongsTo(Post, {
        foreignKey: 'postId',
        as: 'post'
      });

      Comment.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user'
      });

      Comment.belongsTo(User, {
        foreignKey: 'deletedBy',
        as: 'deletedByUser'
      });

      // Self-referencing for nested comments
      Comment.hasMany(Comment, {
        foreignKey: 'parentCommentId',
        as: 'replies'
      });

      Comment.belongsTo(Comment, {
        foreignKey: 'parentCommentId',
        as: 'parentComment'
      });

      Comment.hasMany(Reaction, {
        foreignKey: 'targetId',
        scope: { targetType: 'comment' },
        as: 'reactions'
      });

    } catch (error) {
      console.error('Error setting up Comment relationships:', error.message);
      throw error;
    }

    try {
      // REACTION RELATIONSHIPS
      Reaction.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user'
      });

    } catch (error) {
      console.error('Error setting up Reaction relationships:', error.message);
      throw error;
    }

    try {
      // SHARE RELATIONSHIPS
      Share.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user'
      });

      Share.belongsTo(Post, {
        foreignKey: 'postId',
        as: 'post'
      });

    } catch (error) {
      console.error('Error setting up Share relationships:', error.message);
      throw error;
    }

    try {
      // STORY RELATIONSHIPS
      Story.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user'
      });

      Story.belongsTo(Creator, {
        foreignKey: 'creatorId',
        as: 'creator'
      });

      Story.hasMany(StoryView, {
        foreignKey: 'storyId',
        as: 'views'
      });

    } catch (error) {
      console.error('Error setting up Story relationships:', error.message);
      throw error;
    }

    try {
      // STORY VIEW RELATIONSHIPS
      StoryView.belongsTo(Story, {
        foreignKey: 'storyId',
        as: 'story'
      });

      StoryView.belongsTo(User, {
        foreignKey: 'viewerId',
        as: 'viewer'
      });

    } catch (error) {
      console.error('Error setting up StoryView relationships:', error.message);
      throw error;
    }

    try {
      // InfoPayment RELATIONSHIPS
      InfoPayment.hasMany(Transaction, {
        foreignKey: 'infoPaymentId',
        as: 'transactions'
      });

    } catch (error) {
      console.error('Error setting up InfoPayment relationships:', error.message);
      throw error;
    }

    // Admin relationships
    try {
      // Admin thuộc về 1 User
      Admin.belongsTo(User, {
        foreignKey: 'userId',
        as: 'user'
      });

      // Admin process transactions
      Admin.hasMany(Transaction, {
        foreignKey: 'processedBy',
        as: 'processedTransactions'
      });

    } catch (error) {
      console.error('Error setting up Admin relationships:', error.message);
      throw error;
    }

    return true;

  } catch (error) {
    console.error('Fatal error setting up model associations:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

async function initModels() {
  try {

    await sequelize.authenticate();

    const associationsSuccess = setupAssociations();

    if (!associationsSuccess) {
      throw new Error('Failed to setup model associations');
    }

    console.log('Synchronizing database models...');

    await sequelize.sync({
      alter: true,
      force: false,
      logging: false
    });

    return true;

  } catch (error) {
    console.error('Error initializing models:', error.message);

    if (error.name === 'SequelizeConnectionError') {
      console.error('Database connection failed. Please check your database configuration.');
    } else if (error.message.includes('USING') || error.message.includes('syntax error')) {
      console.log('Attempting to recover from SQL syntax issues...');

      try {
        await sequelize.authenticate();
        console.log('Database connection verified, associations set up');
        return true;
      } catch (authError) {
        console.error('Database authentication failed:', authError.message);
      }
    } else if (error.name === 'SequelizeValidationError') {
      console.error('Model validation error. Please check your model definitions.');
    }

    return false;
  }
}

async function closeDatabase() {
  try {
    await sequelize.close();
  } catch (error) {
    console.error('Error closing database connection:', error.message);
  }
}

process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing database connection...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing database connection...');
  await closeDatabase();
  process.exit(0);
});

module.exports = {
  sequelize,
  User,
  Creator,
  Stream,
  Chat,
  Gift,
  Donation,
  Wallet,
  Transaction,
  Subscription,
  Booking,
  Review,
  Follow,
  Message,
  Conversation,
  Notification,
  Report,
  SupportTicket,
  KYC,
  Analytics,
  StreamPackage,
  CreatorPackageSubscription,
  AffiliateCommission,
  Post,
  Comment,
  Reaction,
  Share,
  Story,
  StoryView,
  InfoPayment,
  Admin,
  initModels,
  setupAssociations,
  closeDatabase
};