const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  firstName: {
    type: DataTypes.STRING
  },
  lastName: {
    type: DataTypes.STRING
  },
  avatar: {
    type: DataTypes.STRING
  },
  dateOfBirth: {
    type: DataTypes.DATE
  },
  gender: {
    type: DataTypes.ENUM('male', 'female', 'other')
  },
  role: {
    type: DataTypes.ENUM('guest', 'user', 'creator', 'admin'),
    defaultValue: 'user'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isEmailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  lastLogin: {
    type: DataTypes.DATE
  },
  registrationDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  phoneNumber: {
    type: DataTypes.STRING
  },
  country: {
    type: DataTypes.STRING
  },
  city: {
    type: DataTypes.STRING
  },
  timezone: {
    type: DataTypes.STRING
  },
  language: {
    type: DataTypes.STRING,
    defaultValue: 'vi'
  },
  isOnline: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  tokens: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  totalSpent: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.0
  },
  affiliateCode: {
    type: DataTypes.STRING,
    unique: true
  },
  referredBy: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Users',
      key: 'id'
    }
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
  tableName: 'Users',
  timestamps: true,
  hooks: {
    beforeUpdate: (user) => {
      user.updatedAt = new Date();
    }
  },
  indexes: [
    {
      unique: true,
      fields: ['email']
    },
    {
      unique: true,
      fields: ['username']
    },
    {
      unique: true,
      fields: ['affiliateCode']
    }
  ]
});

module.exports = User;