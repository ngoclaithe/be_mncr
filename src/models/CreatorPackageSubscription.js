const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const CreatorPackageSubscription = sequelize.define('CreatorPackageSubscription', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  creatorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Creators',
      key: 'id'
    }
  },
  packageId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'StreamPackages',
      key: 'id'
    }
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  autoRenew: {
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
  tableName: 'CreatorPackageSubscriptions',
  timestamps: true,
  hooks: {
    beforeUpdate: (subscription) => {
      subscription.updatedAt = new Date();
    }
  },
  indexes: [
    {
      fields: ['creatorId']
    },
    {
      fields: ['packageId']
    },
    {
      fields: ['isActive']
    },
    {
      fields: ['endDate']
    }
  ]
});

module.exports = CreatorPackageSubscription;