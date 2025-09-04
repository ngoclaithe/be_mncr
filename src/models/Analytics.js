const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const Analytics = sequelize.define('Analytics', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
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
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  streamTime: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  viewerMinutes: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  maxConcurrentViewers: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  totalDonations: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.0
  },
  totalEarnings: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.0
  },
  newFollowers: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  chatMessages: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  privateShows: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  privateShowEarnings: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.0
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
  tableName: 'Analytics',
  timestamps: true,
  hooks: {
    beforeUpdate: (analytics) => {
      analytics.updatedAt = new Date();
    }
  },
  indexes: [
    {
      unique: true,
      fields: ['userId', 'creatorId', 'date']
    },
    {
      fields: ['date']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['creatorId']
    }
  ]
});

module.exports = Analytics;