const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Message = sequelize.define('Message', {
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
  content: {
    type: DataTypes.TEXT,
    allowNull: true 
  },
  messageType: {
    type: DataTypes.ENUM('text', 'image', 'video', 'gift','audio'),
    defaultValue: 'text'
  },
  mediaUrl: {
    type: DataTypes.STRING,
    allowNull: true 
  },
  reactions: {
    type: DataTypes.JSON, // [{ userId: 1, emoji: "❤️" }]
    allowNull: true
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true
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
  tableName: 'Messages',
  timestamps: true,
  hooks: {
    beforeUpdate: (message) => {
      message.updatedAt = new Date();
    }
  },
  indexes: [
    { fields: ['senderId'] },
    { fields: ['receiverId'] },
    { fields: ['createdAt'] },
    { fields: ['messageType'] }
  ]
});

module.exports = Message;
