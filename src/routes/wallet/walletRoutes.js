const express = require('express');
const router = express.Router();
const walletController = require('../../controllers/payment/walletController');
const { protect } = require('../../middleware/auth');
const {
  transferValidator,
  withdrawalValidator,
} = require('../../middleware/validation/walletValidation');

// All routes in this file are protected
router.use(protect);

// @route   GET /api/v1/wallet
// @desc    Get current user's wallet details
router.get('/', walletController.getWallet);

// @route   GET /api/v1/wallet/history
// @desc    Get wallet transaction history
router.get('/history', walletController.getWalletHistory);

// @route   POST /api/v1/wallet/transfer
// @desc    Transfer funds to another user
router.post('/transfer', transferValidator, walletController.transferFunds);

// @route   POST /api/v1/wallet/withdraw
// @desc    Request a withdrawal from the wallet
router.post('/withdraw', withdrawalValidator, walletController.requestWithdrawal);

module.exports = router;