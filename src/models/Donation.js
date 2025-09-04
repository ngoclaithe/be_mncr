const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const Donation = sequelize.define('Donation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  streamId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Streams',
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
  giftId: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Gifts',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT
  },
  isAnonymous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'Donations',
  timestamps: false,
  indexes: [
    {
      fields: ['streamId']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['giftId']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = Donation;