const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const StoryView = sequelize.define('StoryView', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  storyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Stories',
      key: 'id'
    }
  },
  viewerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  viewedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'StoryViews',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['storyId', 'viewerId']
    },
    {
      fields: ['storyId']
    },
    {
      fields: ['viewerId']
    },
    {
      fields: ['viewedAt']
    }
  ]
});

module.exports = StoryView;