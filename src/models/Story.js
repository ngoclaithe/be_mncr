const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const Story = sequelize.define('Story', {
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
  creatorId: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Creators',
      key: 'id'
    }
  },
  content: {
    type: DataTypes.TEXT
  },
  mediaType: {
    type: DataTypes.ENUM('image', 'video'),
    allowNull: false
  },
  mediaUrl: {
    type: DataTypes.STRING,
    allowNull: false
  },
  thumbnailUrl: {
    type: DataTypes.STRING
  },
  duration: {
    type: DataTypes.INTEGER,
    defaultValue: 86400
  },
  viewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'Stories',
  timestamps: false,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['creatorId']
    },
    {
      fields: ['isActive']
    },
    {
      fields: ['expiresAt']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = Story;