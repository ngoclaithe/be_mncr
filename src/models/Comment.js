const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const Comment = sequelize.define('Comment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  postId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Posts',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  parentCommentId: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Comments',
      key: 'id'
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  mediaUrl: {
    type: DataTypes.STRING
  },
  likeCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  replyCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isEdited: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  editedAt: {
    type: DataTypes.DATE
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  deletedAt: {
    type: DataTypes.DATE
  },
  deletedBy: {
    type: DataTypes.INTEGER,
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
  }
}, {
  tableName: 'Comments',
  timestamps: true,
  hooks: {
    beforeUpdate: (comment) => {
      comment.updatedAt = new Date();
    }
  },
  indexes: [
    {
      fields: ['postId']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['parentCommentId']
    },
    {
      fields: ['isDeleted']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = Comment;