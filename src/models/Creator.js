const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const Creator = sequelize.define('Creator', {
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
  stageName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  titleBio: {
    type: DataTypes.STRING,
    allowNull: true
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  bioUrls: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  rating: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0.0,
    validate: {
      min: 0,
      max: 5
    }
  },
  totalRatings: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isLive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  bioThumbnail: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  hourlyRate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  minBookingDuration: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  maxConcurrentBookings: {
    type: DataTypes.INTEGER,
    defaultValue: 10
  },
  currentBookingsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  totalEarnings: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.0
  },
  availabilitySchedule: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  specialties: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  languages: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  bodyType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  height: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  weight: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  measurement: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  eyeColor: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  service: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isTatto: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  signature: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  hairColor: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  cosmeticSurgery: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isAvailableForBooking: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  bookingPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  subscriptionPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
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
  tableName: 'Creators',
  timestamps: true,
  hooks: {
    beforeUpdate: (creator) => {
      creator.updatedAt = new Date();
    }
  }
});

module.exports = Creator;