const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const Follow = sequelize.define('Follow', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  followerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  creatorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Creators',
      key: 'id'
    }
  },
  notificationEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'Follows',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['followerId', 'creatorId']
    },
    {
      fields: ['followerId']
    },
    {
      fields: ['creatorId']
    }
  ]
});

module.exports = Follow;