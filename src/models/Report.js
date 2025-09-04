const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const Report = sequelize.define('Report', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  reporterId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  reportedUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('harassment', 'spam', 'inappropriate_content', 'fake_profile', 'other'),
    allowNull: false
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  evidence: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  status: {
    type: DataTypes.ENUM('pending', 'under_review', 'resolved', 'dismissed'),
    defaultValue: 'pending'
  },
  adminNotes: {
    type: DataTypes.TEXT
  },
  actionTaken: {
    type: DataTypes.TEXT
  },
  resolvedBy: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  resolvedAt: {
    type: DataTypes.DATE
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
  tableName: 'Reports',
  timestamps: true,
  hooks: {
    beforeUpdate: (report) => {
      report.updatedAt = new Date();
    }
  },
  indexes: [
    {
      fields: ['reporterId']
    },
    {
      fields: ['reportedUserId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['type']
    }
  ]
});

module.exports = Report;