const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RequestDeposit = sequelize.define('RequestDeposit', {
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
    infoPaymentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'InfoPayments',
            key: 'id'
        }
    },
    amount: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    codePay: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'RequestDeposits',
    timestamps: false
});


module.exports = RequestDeposit;
