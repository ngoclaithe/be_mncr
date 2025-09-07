const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const {
  createDepositRequest,
  createWithdrawRequest,
  getTransactions,
  getTransactionById,
  updateTransactionStatus,
  deleteTransaction,
  getTransactionSummary
} = require('../../controllers/payment/transactionController');

const { protect, authorize } = require('../../middleware/auth');

// Validation middleware
const validateDeposit = [
  body('amount')
    .isFloat({ min: 1000 })
    .withMessage('Amount must be at least 1,000 VND'),
  body('infoPaymentId')
    .isInt({ min: 1 })
    .withMessage('Valid info payment ID is required'),
  body('codePay')
    .notEmpty()
    .withMessage('Payment code is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Payment code must be between 3-100 characters'),
  body('paymentMethod')
    .optional()
    .isIn(['bank_transfer', 'momo', 'zalopay', 'vnpay'])
    .withMessage('Invalid payment method'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
];

const validateWithdraw = [
  body('amount')
    .isFloat({ min: 10 })
    .withMessage('Minimum withdrawal amount is 10,000 VND'),
  body('paymentMethod')
    .isIn(['bank_transfer', 'momo', 'zalopay'])
    .withMessage('Invalid payment method for withdrawal'),
  body('bankInfo')
    .notEmpty()
    .withMessage('Bank information is required for withdrawal'),
  body('bankInfo.accountNumber')
    .notEmpty()
    .withMessage('Bank account number is required'),
  body('bankInfo.accountName')
    .notEmpty()
    .withMessage('Bank account name is required'),
  body('bankInfo.bankCode')
    .notEmpty()
    .withMessage('Bank code is required'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
];

const validateStatusUpdate = [
  body('status')
    .isIn(['completed', 'failed', 'cancelled', 'approved', 'rejected'])
    .withMessage('Invalid status'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
];

// Routes

/**
 * @route   POST /api/v1/transactions/deposit
 * @desc    Create a new deposit request
 * @access  Private (User)
 */
router.post('/deposit', protect, validateDeposit, createDepositRequest);

/**
 * @route   POST /api/v1/transactions/withdraw
 * @desc    Create a new withdrawal request
 * @access  Private (User)
 */
router.post('/withdraw', protect, validateWithdraw, createWithdrawRequest);

/**
 * @route   GET /api/v1/transactions
 * @desc    Get all transactions with filters
 * @access  Private
 * @query   page, limit, status, type, userId (admin only), startDate, endDate
 */
router.get('/', protect, getTransactions);

/**
 * @route   GET /api/v1/transactions/summary
 * @desc    Get transaction summary/stats for user
 * @access  Private
 */
router.get('/summary', protect, getTransactionSummary);

/**
 * @route   GET /api/v1/transactions/:id
 * @desc    Get transaction by ID
 * @access  Private
 */
router.get('/:id', protect, getTransactionById);

/**
 * @route   PATCH /api/v1/transactions/:id/status
 * @desc    Update transaction status (Admin only)
 * @access  Private (Admin)
 */
router.patch('/:id/status', protect, authorize('admin'), validateStatusUpdate, updateTransactionStatus);

/**
 * @route   DELETE /api/v1/transactions/:id
 * @desc    Delete transaction (Admin only, pending transactions only)
 * @access  Private (Admin)
 */
router.delete('/:id', protect, authorize('admin'), deleteTransaction);

// Additional specific routes for different transaction types

/**
 * @route   GET /api/v1/transactions/deposits
 * @desc    Get only deposit transactions
 * @access  Private
 */
router.get('/deposits', protect, (req, res, next) => {
  req.query.type = 'deposit';
  getTransactions(req, res, next);
});

/**
 * @route   GET /api/v1/transactions/withdrawals
 * @desc    Get only withdrawal transactions
 * @access  Private
 */
router.get('/withdrawals', protect, (req, res, next) => {
  req.query.type = 'withdraw';
  getTransactions(req, res, next);
});

/**
 * @route   GET /api/v1/transactions/bookings
 * @desc    Get only booking transactions
 * @access  Private
 */
router.get('/bookings', protect, (req, res, next) => {
  req.query.type = 'booking';
  getTransactions(req, res, next);
});

module.exports = router;