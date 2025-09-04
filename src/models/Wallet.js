const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const Wallet = sequelize.define('Wallet', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  balance: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.0
  },
  tokens: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  frozenBalance: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.0
  },
  frozenTokens: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  totalDeposited: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.0
  },
  totalWithdrawn: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.0
  },
  bankAccountNumber: {
    type: DataTypes.STRING
  },
  bankName: {
    type: DataTypes.STRING
  },
  bankAccountHolder: {
    type: DataTypes.STRING
  },
  paypalEmail: {
    type: DataTypes.STRING
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
  tableName: 'Wallets',
  timestamps: true,
  hooks: {
    beforeUpdate: (wallet) => {
      wallet.updatedAt = new Date();
    }
  },
  indexes: [
    {
      unique: true,
      fields: ['userId']
    }
  ]
});

module.exports = Wallet;