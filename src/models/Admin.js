const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Admin = sequelize.define('Admin', {
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

  role: {
    type: DataTypes.ENUM(
      'superadmin',   // toàn quyền
      'manager',      // quản lý creator, tài chính
      'moderator',    // kiểm duyệt nội dung, báo cáo
      'support'       // chăm sóc khách hàng
    ),
    allowNull: false,
    defaultValue: 'moderator'
  },

  permissions: {
    type: DataTypes.JSON,
    defaultValue: {}
  },

  lastLoginAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },

  lastLoginIp: {
    type: DataTypes.STRING,
    allowNull: true
  },

  status: {
    type: DataTypes.ENUM('active', 'suspended', 'deleted'),
    defaultValue: 'active'
  },

  notes: {
    type: DataTypes.TEXT,
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
  tableName: 'Admins',
  timestamps: true,
  hooks: {
    beforeUpdate: (admin) => {
      admin.updatedAt = new Date();
    }
  }
});

module.exports = Admin;
