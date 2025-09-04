const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const Chat = sequelize.define('Chat', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  streamId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Streams',
      key: 'id'
    }
  },
  senderId: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  username: {
    type: DataTypes.STRING
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  messageType: {
    type: DataTypes.ENUM('text', 'gift', 'emoji', 'system'),
    defaultValue: 'text'
  },
  isFromModerator: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  deletedBy: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  deletedAt: {
    type: DataTypes.DATE
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'Chats',
  timestamps: true,
  hooks: {
    beforeUpdate: (chat) => {
      chat.updatedAt = new Date();
    }
  },
  indexes: [
    {
      fields: ['streamId']
    },
    {
      fields: ['senderId']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['messageType']
    }
  ]
});

module.exports = Chat;