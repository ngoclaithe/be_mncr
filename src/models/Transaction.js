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
    allowNull: true, // Can be null for deposits (external source)
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  toUserId: {
    type: DataTypes.INTEGER,
    allowNull: true, // Can be null for withdraws (external destination)
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('deposit', 'withdraw', 'donation', 'booking', 'subscription', 'refund', 'commission', 'transfer'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  tokenAmount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Token amount for deposit transactions (1000 VND = 1 token)'
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'VND'
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled', 'approved', 'rejected'),
    defaultValue: 'pending'
  },
  description: {
    type: DataTypes.TEXT
  },
  referenceId: {
    type: DataTypes.STRING(100),
    comment: 'External reference ID (codePay, booking ID, etc.)'
  },
  paymentMethod: {
    type: DataTypes.ENUM('bank_transfer', 'momo', 'zalopay', 'vnpay', 'paypal', 'wallet', 'cash'),
    allowNull: true
  },
  paymentGateway: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  gatewayTransactionId: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  // Related entities
  bookingId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Bookings',
      key: 'id'
    }
  },
  streamId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Streams',
      key: 'id'
    }
  },
  subscriptionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Subscriptions',
      key: 'id'
    }
  },
  // For backward compatibility with RequestDeposit
  infoPaymentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'InfoPayments',
      key: 'id'
    },
    comment: 'For deposit requests - payment info used'
  },
  // Commission fields
  commissionRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: 'Commission percentage (e.g., 10.50 for 10.5%)'
  },
  commissionAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  parentTransactionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Transactions',
      key: 'id'
    },
    comment: 'For commission/refund transactions linked to parent transaction'
  },
  // Additional metadata
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional data like codePay, bank info, processing details, etc.'
  },
  // Processing fields
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  processedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    },
    comment: 'Admin user who processed this transaction'
  },
  // Failure handling
  failureReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  retryCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
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
      if (transaction.changed('status') && 
          ['completed', 'failed', 'cancelled', 'rejected'].includes(transaction.status)) {
        transaction.processedAt = new Date();
      }
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
    },
    {
      fields: ['bookingId']
    },
    {
      fields: ['streamId']
    },
    {
      fields: ['parentTransactionId']
    },
    {
      fields: ['infoPaymentId']
    },
    {
      name: 'idx_transaction_user_type_status',
      fields: ['fromUserId', 'type', 'status']
    },
    {
      name: 'idx_transaction_date_type',
      fields: ['createdAt', 'type']
    }
  ],
  validate: {
    // Custom validation
    validateUserIds() {
      if (this.type === 'transfer' && (!this.fromUserId || !this.toUserId)) {
        throw new Error('Transfer transactions must have both fromUserId and toUserId');
      }
      if (this.type === 'deposit' && this.toUserId) {
        throw new Error('Deposit transactions should not have toUserId');
      }
      if (this.type === 'withdraw' && this.toUserId) {
        throw new Error('Withdraw transactions should not have toUserId');
      }
    },
    validateCommission() {
      if (this.type === 'commission' && !this.parentTransactionId) {
        throw new Error('Commission transactions must have parentTransactionId');
      }
    }
  }
});

module.exports = Transaction;