const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const Post = sequelize.define('Post', {
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
    type: DataTypes.ENUM('text', 'image', 'video', 'mixed'),
    defaultValue: 'text'
  },
  mediaUrls: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  thumbnailUrl: {
    type: DataTypes.STRING
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isPremium: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  price: {
    type: DataTypes.INTEGER
  },
  viewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  likeCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  commentCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  shareCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('draft', 'published', 'archived', 'deleted'),
    defaultValue: 'draft'
  },
  scheduledAt: {
    type: DataTypes.DATE
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  location: {
    type: DataTypes.STRING
  },
  isPromoted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
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
  tableName: 'Posts',
  timestamps: true,
  hooks: {
    beforeUpdate: (post) => {
      post.updatedAt = new Date();
    }
  },
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['creatorId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['isPremium']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = Post;