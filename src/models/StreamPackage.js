const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const StreamPackage = sequelize.define('StreamPackage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  features: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  maxConcurrentStreams: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  maxStreamDuration: {
    type: DataTypes.INTEGER
  },
  prioritySupport: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
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
  tableName: 'StreamPackages',
  timestamps: true,
  hooks: {
    beforeUpdate: (package) => {
      package.updatedAt = new Date();
    }
  },
  indexes: [
    {
      fields: ['isActive']
    },
    {
      fields: ['price']
    }
  ]
});

module.exports = StreamPackage;