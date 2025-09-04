const { Wallet, User, WalletTransaction, WithdrawalRequest, sequelize } = require('../../models');
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../../utils/ApiError');
const { validationResult } = require('express-validator');

/**
 * @desc    Get current user's wallet
 * @route   GET /api/v1/wallet
 * @access  Private
 */
const getWallet = async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({
      where: { userId: req.user.id },
      attributes: ['balance', 'updatedAt'],
    });

    if (!wallet) {
      return next(new ApiError('Wallet not found for this user.', StatusCodes.NOT_FOUND));
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: wallet,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get wallet transaction history
 * @route   GET /api/v1/wallet/history
 * @access  Private
 */
const getWalletHistory = async (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const wallet = await Wallet.findOne({ where: { userId: req.user.id } });
        if (!wallet) {
            return next(new ApiError('Wallet not found.', StatusCodes.NOT_FOUND));
        }

        const { count, rows } = await WalletTransaction.findAndCountAll({
            where: { walletId: wallet.id },
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']],
        });

        res.status(StatusCodes.OK).json({
            success: true,
            data: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit),
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Transfer funds to another user
 * @route   POST /api/v1/wallet/transfer
 * @access  Private
 */
const transferFunds = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(StatusCodes.BAD_REQUEST).json({ success: false, errors: errors.array() });
    }

    const { recipientId, amount, description } = req.body;
    const senderId = req.user.id;

    try {
        const result = await sequelize.transaction(async (t) => {
            const senderWallet = await Wallet.findOne({
                where: { userId: senderId },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (!senderWallet || senderWallet.balance < amount) {
                throw new ApiError('Insufficient funds.', StatusCodes.BAD_REQUEST);
            }

            const recipientWallet = await Wallet.findOne({
                where: { userId: recipientId },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (!recipientWallet) {
                throw new ApiError('Recipient wallet not found.', StatusCodes.NOT_FOUND);
            }

            await senderWallet.decrement('balance', { by: amount, transaction: t });
            await recipientWallet.increment('balance', { by: amount, transaction: t });

            await WalletTransaction.create({
                walletId: senderWallet.id,
                type: 'transfer_out',
                amount,
                description,
                status: 'completed',
                relatedUserId: recipientId,
            }, { transaction: t });

            await WalletTransaction.create({
                walletId: recipientWallet.id,
                type: 'transfer_in',
                amount,
                description,
                status: 'completed',
                relatedUserId: senderId,
            }, { transaction:t });

            return { newBalance: senderWallet.balance - amount };
        });

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Transfer successful.',
            data: { newBalance: result.newBalance },
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Request a withdrawal
 * @route   POST /api/v1/wallet/withdraw
 * @access  Private
 */
const requestWithdrawal = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(StatusCodes.BAD_REQUEST).json({ success: false, errors: errors.array() });
    }

    const { amount, userBankDetailId } = req.body;
    const userId = req.user.id;

    try {
        const result = await sequelize.transaction(async (t) => {
            const wallet = await Wallet.findOne({
                where: { userId: userId },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (!wallet || wallet.balance < amount) {
                throw new ApiError('Insufficient funds for withdrawal.', StatusCodes.BAD_REQUEST);
            }

            await wallet.decrement('balance', { by: amount, transaction: t });

            const withdrawalRequest = await WithdrawalRequest.create({
                userId,
                amount,
                userBankDetailId,
                status: 'pending',
            }, { transaction: t });

            await WalletTransaction.create({
                walletId: wallet.id,
                type: 'withdrawal_request',
                amount,
                description: `Withdrawal request #${withdrawalRequest.id}`,
                status: 'pending',
                relatedRequestId: withdrawalRequest.id,
            }, { transaction: t });

            return { newBalance: wallet.balance - amount };
        });

        res.status(StatusCodes.CREATED).json({
            success: true,
            message: 'Withdrawal request submitted successfully.',
            data: { newBalance: result.newBalance },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getWallet,
    getWalletHistory,
    transferFunds,
    requestWithdrawal,
};