const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const Share = sequelize.define('Share', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  postId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Posts',
      key: 'id'
    }
  },
  shareType: {
    type: DataTypes.ENUM('repost', 'story', 'message'),
    allowNull: false
  },
  caption: {
    type: DataTypes.TEXT
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'Shares',
  timestamps: false,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['postId']
    },
    {
      fields: ['shareType']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = Share;