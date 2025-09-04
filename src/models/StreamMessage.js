const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const StreamMessage = sequelize.define('StreamMessage', {
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
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  typeMessage: {
    type: DataTypes.ENUM('text', 'image', 'video', 'file', 'gift'),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  giftId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Gifts',
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
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
  tableName: 'StreamMessages',
  timestamps: true,
  hooks: {
    beforeUpdate: (package) => {
      package.updatedAt = new Date();
    }
  },
  indexes: [
    {
      fields: ['senderId']
    },
    {
      fields: ['giftId']
    }
  ]
});

module.exports = StreamMessage;