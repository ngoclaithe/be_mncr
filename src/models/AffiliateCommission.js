const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const AffiliateCommission = sequelize.define('AffiliateCommission', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  affiliateUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  referredUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  transactionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Transactions',
      key: 'id'
    }
  },
  commissionRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false
  },
  commissionAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'cancelled'),
    defaultValue: 'pending'
  },
  paidAt: {
    type: DataTypes.DATE
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'AffiliateCommission',
  timestamps: false,
  indexes: [
    {
      fields: ['affiliateUserId']
    },
    {
      fields: ['referredUserId']
    },
    {
      fields: ['transactionId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = AffiliateCommission;