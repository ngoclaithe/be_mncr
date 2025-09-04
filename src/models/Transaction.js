const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  fromUserId: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  toUserId: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('deposit', 'withdraw', 'donation', 'booking', 'subscription', 'refund', 'commission'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  tokenAmount: {
    type: DataTypes.INTEGER
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'VND'
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
    defaultValue: 'pending'
  },
  description: {
    type: DataTypes.TEXT
  },
  referenceId: {
    type: DataTypes.STRING
  },
  paymentMethod: {
    type: DataTypes.ENUM('bank_transfer', 'momo', 'zalopay', 'vnpay', 'paypal')
  },
  paymentGateway: {
    type: DataTypes.STRING
  },
  gatewayTransactionId: {
    type: DataTypes.STRING
  },
  bookingId: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Bookings',
      key: 'id'
    }
  },
  streamId: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Streams',
      key: 'id'
    }
  },
  commissionRate: {
    type: DataTypes.DECIMAL(5, 2)
  },
  commissionAmount: {
    type: DataTypes.DECIMAL(15, 2)
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
  tableName: 'Transactions',
  timestamps: true,
  hooks: {
    beforeUpdate: (transaction) => {
      transaction.updatedAt = new Date();
    }
  },
  indexes: [
    {
      fields: ['fromUserId']
    },
    {
      fields: ['toUserId']
    },
    {
      fields: ['type']
    },
    {
      fields: ['status']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['referenceId']
    }
  ]
});

module.exports = Transaction;