const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Review = sequelize.define('Review', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  bookingId: {
    type: DataTypes.INTEGER,
    allowNull: true, 
    references: {
      model: 'Bookings',
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
  creatorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Creators',
      key: 'id'
    }
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  comment: {
    type: DataTypes.TEXT
  },
  images: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of image URLs'
  },
  isAnonymous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  adminResponse: {
    type: DataTypes.TEXT
  },
  trustLevel: {
    type: DataTypes.ENUM('verified', 'unverified'),
    defaultValue: 'unverified'
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
  tableName: 'Reviews',
  timestamps: true,
  hooks: {
    beforeCreate: (review) => {
      if (review.bookingId) {
        review.trustLevel = 'verified';
      } else {
        review.trustLevel = 'unverified';
      }
    },
    beforeUpdate: (review) => {
      review.updatedAt = new Date();
    }
  },
  indexes: [
    {
      fields: ['bookingId']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['creatorId']
    },
    {
      fields: ['rating']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = Review;