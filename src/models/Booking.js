const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  creatorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Creators',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('private_show', 'private_chat', 'cam2cam', 'byshot', 'byhour'),
    allowNull: false
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  scheduledTime: {
    type: DataTypes.DATE
  },
  startTime: {
    type: DataTypes.DATE
  },
  endTime: {
    type: DataTypes.DATE
  },
  pricePerMinute: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  totalPrice: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  tokenAmount: {
    type: DataTypes.INTEGER
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'),
    defaultValue: 'pending'
  },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'paid', 'refunded'),
    defaultValue: 'pending'
  },
  streamUrl: {
    type: DataTypes.STRING
  },
  chatRoomId: {
    type: DataTypes.STRING
  },
  notes: {
    type: DataTypes.TEXT
  },
  cancellationReason: {
    type: DataTypes.TEXT
  },
  cancelledBy: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  isRated: {
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
  tableName: 'Bookings',
  timestamps: true,
  hooks: {
    beforeUpdate: (booking) => {
      booking.updatedAt = new Date();
    }
  },
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['creatorId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['paymentStatus']
    },
    {
      fields: ['scheduledTime']
    }
  ]
});

module.exports = Booking;