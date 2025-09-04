const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InfoPayment = sequelize.define('InfoPayment', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    bankNumber: { 
        type: DataTypes.STRING,
        allowNull: false
    },
    accountName: { 
        type: DataTypes.STRING,
        allowNull: false
    },
    bankName: { 
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            isEmail: true
        }
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    metadata: {
        type: DataTypes.JSON, 
        allowNull: true
    },
    isActive: {   // 👈 dùng đúng tên mới trong DB
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'InfoPayments',
    timestamps: true
});

module.exports = InfoPayment;
