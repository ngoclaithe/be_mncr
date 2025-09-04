const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const Gift = sequelize.define('Gift', {
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
  imageUrl: {
    type: DataTypes.STRING
  },
  animationUrl: {
    type: DataTypes.STRING
  },
  price: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING
  },
  rarity: {
    type: DataTypes.ENUM('common', 'rare', 'epic', 'legendary'),
    defaultValue: 'common'
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
  tableName: 'Gifts',
  timestamps: true,
  hooks: {
    beforeUpdate: (gift) => {
      gift.updatedAt = new Date();
    }
  },
  indexes: [
    {
      fields: ['category']
    },
    {
      fields: ['rarity']
    },
    {
      fields: ['isActive']
    }
  ]
});

module.exports = Gift;