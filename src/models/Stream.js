const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const Stream = sequelize.define('Stream', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  creatorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Creators',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  thumbnail: {
    type: DataTypes.STRING
  },
  streamKey: {
    type: DataTypes.STRING,
    unique: true
  },
  streamUrl: {
    type: DataTypes.STRING
  },
  hlsUrl: {
    type: DataTypes.STRING
  },
  isLive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isPrivate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  viewerCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  maxViewers: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  category: {
    type: DataTypes.STRING
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  quality: {
    type: DataTypes.ENUM('SD', 'HD', '4K'),
    defaultValue: 'HD'
  },
  startTime: {
    type: DataTypes.DATE
  },
  endTime: {
    type: DataTypes.DATE
  },
  duration: {
    type: DataTypes.INTEGER
  },
  recordingUrl: {
    type: DataTypes.STRING
  },
  chatEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  donationsEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  pricePerMinute: {
    type: DataTypes.DECIMAL(10, 2)
  },
  totalDonations: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.0
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
  tableName: 'Streams',
  timestamps: true,
  hooks: {
    beforeUpdate: (stream) => {
      stream.updatedAt = new Date();
    }
  },
  indexes: [
    {
      unique: true,
      fields: ['streamKey']
    },
    {
      fields: ['creatorId']
    },
    {
      fields: ['isLive']
    }
  ]
});

module.exports = Stream;