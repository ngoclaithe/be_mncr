const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Conversation = sequelize.define('Conversation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  senderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  receiverId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  lastMessageId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Messages',
      key: 'id'
    }
  },
  lastMessageAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isBlocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  blockedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  isMuted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  mutedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  topic: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  }
}, {
  tableName: 'Conversations',
  timestamps: true,
  hooks: {
    beforeUpdate: (conversation) => {
      conversation.updatedAt = new Date();
    }
  },
  indexes: [
    { fields: ['senderId'] },
    { fields: ['receiverId'] },
    { fields: ['lastMessageAt'] }
  ]
});

module.exports = Conversation;
