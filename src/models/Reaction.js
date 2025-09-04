const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const Reaction = sequelize.define('Reaction', {
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
  targetType: {
    type: DataTypes.ENUM('post', 'comment', 'stream'),
    allowNull: false
  },
  targetId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  reactionType: {
    type: DataTypes.ENUM('like', 'love', 'wow', 'laugh', 'angry', 'sad'),
    defaultValue: 'like'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'Reactions',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['userId', 'targetType', 'targetId']
    },
    {
      fields: ['targetType', 'targetId']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['reactionType']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = Reaction;