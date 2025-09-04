const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const KYC = sequelize.define('KYC', {
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
  documentType: {
    type: DataTypes.ENUM('passport', 'id_card', 'driving_license'),
    allowNull: false
  },
  documentNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  documentFrontUrl: {
    type: DataTypes.STRING,
    allowNull: false
  },
  documentBackUrl: {
    type: DataTypes.STRING
  },
  selfieUrl: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  dateOfBirth: {
    type: DataTypes.DATE,
    allowNull: false
  },
  nationality: {
    type: DataTypes.STRING
  },
  address: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'expired'),
    defaultValue: 'pending'
  },
  reviewedBy: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  reviewNotes: {
    type: DataTypes.TEXT
  },
  rejectionReason: {
    type: DataTypes.TEXT
  },
  expiryDate: {
    type: DataTypes.DATE
  },
  verifiedAt: {
    type: DataTypes.DATE
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
  tableName: 'KYC',
  timestamps: true,
  hooks: {
    beforeUpdate: (kyc) => {
      kyc.updatedAt = new Date();
    }
  },
  indexes: [
    {
      unique: true,
      fields: ['userId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['documentType']
    }
  ]
});

module.exports = KYC;