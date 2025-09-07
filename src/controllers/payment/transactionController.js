const { Transaction, InfoPayment, User, Wallet, sequelize } = require('../../models');
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../../utils/ApiError');
const { validationResult } = require('express-validator');

/**
 * @desc    Create a new deposit request transaction
 * @route   POST /api/v1/transactions/deposit
 * @access  Private (User)
 */
const createDepositRequest = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({ success: false, errors: errors.array() });
  }

  try {
    const { amount, infoPaymentId, codePay, paymentMethod, description } = req.body;
    const userId = req.user.id;

    console.log('Creating deposit transaction:', {
      userId,
      amount,
      infoPaymentId,
      codePay,
      paymentMethod
    });

    // Calculate token amount (1000 VND = 1 token)
    const tokenAmount = Math.floor(amount / 1000);

    const newTransaction = await Transaction.create({
      fromUserId: userId,
      toUserId: null, // For deposits, money comes from external source
      type: 'deposit',
      amount,
      tokenAmount,
      currency: 'VND',
      status: 'pending',
      description: description || `Deposit request - Code: ${codePay}`,
      referenceId: codePay,
      paymentMethod: paymentMethod || 'bank_transfer',
      infoPaymentId,
      metadata: {
        codePay,
        infoPaymentId,
        requestedAt: new Date()
      }
    });

    console.log('Deposit transaction created successfully:', newTransaction.toJSON());

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Deposit request created successfully. Please wait for admin approval.',
      data: newTransaction,
    });
  } catch (error) {
    console.error('Error creating deposit transaction:', error);
    next(error);
  }
};

/**
 * @desc    Create a withdraw request transaction
 * @route   POST /api/v1/transactions/withdraw
 * @access  Private (User)
 */
const createWithdrawRequest = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({ success: false, errors: errors.array() });
  }

  try {
    const { amount, paymentMethod, bankInfo, description } = req.body;
    const userId = req.user.id;

    // Check if user has enough balance
    const wallet = await Wallet.findOne({ where: { userId } });
    if (!wallet || wallet.balance < amount) {
      return next(new ApiError('Insufficient balance', StatusCodes.BAD_REQUEST));
    }

    const newTransaction = await Transaction.create({
      fromUserId: userId,
      toUserId: null,
      type: 'withdraw',
      amount,
      tokenAmount: null,
      currency: 'VND',
      status: 'pending',
      description: description || 'Withdraw request',
      paymentMethod,
      metadata: {
        bankInfo,
        requestedAt: new Date()
      }
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Withdraw request created successfully. Please wait for admin approval.',
      data: newTransaction,
    });
  } catch (error) {
    console.error('Error creating withdraw transaction:', error);
    next(error);
  }
};

/**
 * @desc    Get all transactions with filters
 * @route   GET /api/v1/transactions
 * @access  Private
 */
const getTransactions = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      type, 
      userId, 
      startDate, 
      endDate 
    } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    
    // If not admin, only show user's own transactions
    if (req.user.role !== 'admin') {
      whereClause[sequelize.Op.or] = [
        { fromUserId: req.user.id },
        { toUserId: req.user.id }
      ];
    } else if (userId) {
      whereClause[sequelize.Op.or] = [
        { fromUserId: userId },
        { toUserId: userId }
      ];
    }

    if (status) {
      whereClause.status = status;
    }

    if (type) {
      whereClause.type = type;
    }

    if (startDate && endDate) {
      whereClause.createdAt = {
        [sequelize.Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    console.log('Getting transactions with filters:', {
      whereClause,
      page,
      limit,
      userRole: req.user.role
    });

    const { count, rows } = await Transaction.findAndCountAll({
      where: whereClause,
      include: [
        { model: User, as: 'fromUser', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: User, as: 'toUser', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: InfoPayment, as: 'infoPayment', required: false },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
    });

    console.log(`Found ${count} transactions`);

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
    console.error('Error getting transactions:', error);
    next(error);
  }
};

/**
 * @desc    Get a single transaction by ID
 * @route   GET /api/v1/transactions/:id
 * @access  Private
 */
const getTransactionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('Getting transaction by ID:', id);

    const transaction = await Transaction.findByPk(id, {
      include: [
        { model: User, as: 'fromUser', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: User, as: 'toUser', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: InfoPayment, as: 'infoPayment', required: false },
      ],
    });

    if (!transaction) {
      console.log('Transaction not found:', id);
      return res.status(StatusCodes.OK).json({
        success: true,
        data: null,
        message: 'Transaction not found'
      });
    }

    // Check authorization
    if (req.user.role !== 'admin' && 
        transaction.fromUserId !== req.user.id && 
        transaction.toUserId !== req.user.id) {
      console.log('Unauthorized access attempt:', {
        transactionFromUserId: transaction.fromUserId,
        transactionToUserId: transaction.toUserId,
        currentUserId: req.user.id,
        userRole: req.user.role
      });
      return next(new ApiError('You are not authorized to view this transaction', StatusCodes.FORBIDDEN));
    }

    console.log('Transaction found:', transaction.toJSON());

    res.status(StatusCodes.OK).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error('Error getting transaction by ID:', error);
    next(error);
  }
};

/**
 * @desc    Update transaction status (for Admin)
 * @route   PATCH /api/v1/transactions/:id/status
 * @access  Private (Admin)
 */
const updateTransactionStatus = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({ success: false, errors: errors.array() });
  }

  const { id } = req.params;
  const { status, gatewayTransactionId, description } = req.body;

  try {
    console.log('Updating transaction status:', {
      transactionId: id,
      newStatus: status,
      gatewayTransactionId,
      adminId: req.user.id
    });

    const transaction = await Transaction.findByPk(id);

    if (!transaction) {
      console.log('Transaction not found:', id);
      return next(new ApiError('Transaction not found', StatusCodes.NOT_FOUND));
    }

    if (transaction.status !== 'pending') {
      console.log('Cannot update non-pending transaction:', {
        transactionId: id,
        currentStatus: transaction.status,
        attemptedStatus: status
      });
      return next(new ApiError(`Cannot update a transaction that is already ${transaction.status}`, StatusCodes.BAD_REQUEST));
    }

    console.log('✅ Status check passed, proceeding with transaction...');

    const result = await sequelize.transaction(async (t) => {
      console.log('🔄 Database transaction started');
      
      // Update transaction status
      transaction.status = status;
      if (description) {
        transaction.description = description;
      }
      
      // Update metadata
      transaction.metadata = {
        ...transaction.metadata,
        processedAt: new Date(),
        processedBy: req.user.id
      };

      await transaction.save({ transaction: t });

      console.log('✅ Transaction status updated successfully:', {
        transactionId: id,
        newStatus: status
      });

      // Handle wallet updates based on transaction type and status
      if (status === 'completed') {
        await handleWalletUpdate(transaction, t);
      } else if (status === 'failed' && transaction.type === 'withdraw') {
        // Refund withdraw amount back to wallet if failed
        await handleWithdrawRefund(transaction, t);
      }

      return transaction;
    });

    console.log('✅ Database transaction completed successfully');

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Transaction has been ${status}.`,
      data: result,
    });

  } catch (error) {
    console.error('❌ ERROR in updateTransactionStatus:', error);
    next(error);
  }
};

/**
 * Handle wallet updates for completed transactions
 */
const handleWalletUpdate = async (transaction, dbTransaction) => {
  console.log('🪙 Processing wallet update for completed transaction...');
  
  switch (transaction.type) {
    case 'deposit':
      await handleDepositComplete(transaction, dbTransaction);
      break;
    case 'withdraw':
      await handleWithdrawComplete(transaction, dbTransaction);
      break;
    case 'booking':
      await handleBookingComplete(transaction, dbTransaction);
      break;
    case 'refund':
      await handleRefundComplete(transaction, dbTransaction);
      break;
    default:
      console.log('ℹ️ No wallet update needed for transaction type:', transaction.type);
  }
};

const handleDepositComplete = async (transaction, dbTransaction) => {
  const userId = transaction.fromUserId;
  console.log('Processing deposit completion for user:', userId);

  let wallet = await Wallet.findOne({ 
    where: { userId },
    transaction: dbTransaction 
  });

  if (!wallet) {
    console.log('🆕 Creating new wallet for user:', userId);
    wallet = await Wallet.create({ 
      userId,
      balance: 0,
      tokens: 0,
      totalDeposited: 0
    }, { transaction: dbTransaction });
  }

  const tokensToAdd = transaction.tokenAmount || 0;
  console.log('💰 Adding tokens to wallet:', {
    tokensToAdd,
    depositAmount: transaction.amount
  });

  await wallet.increment({
    tokens: tokensToAdd,
    balance: parseFloat(transaction.amount),
    totalDeposited: parseFloat(transaction.amount)
  }, { transaction: dbTransaction });

  console.log('✅ Deposit wallet update completed');
};

const handleWithdrawComplete = async (transaction, dbTransaction) => {
  const userId = transaction.fromUserId;
  console.log('Processing withdraw completion for user:', userId);

  const wallet = await Wallet.findOne({ 
    where: { userId },
    transaction: dbTransaction 
  });

  if (wallet) {
    await wallet.decrement({
      balance: parseFloat(transaction.amount)
    }, { transaction: dbTransaction });
  }

  console.log('✅ Withdraw wallet update completed');
};

const handleWithdrawRefund = async (transaction, dbTransaction) => {
  console.log('Processing withdraw refund for user:', transaction.fromUserId);
  // Implementation for refunding failed withdraw
};

const handleBookingComplete = async (transaction, dbTransaction) => {
  console.log('Processing booking completion');
  // Implementation for booking transactions
};

const handleRefundComplete = async (transaction, dbTransaction) => {
  console.log('Processing refund completion');
  // Implementation for refund transactions
};

/**
 * @desc    Delete a transaction (for Admin, only pending transactions)
 * @route   DELETE /api/v1/transactions/:id
 * @access  Private (Admin)
 */
const deleteTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('Deleting transaction:', {
      transactionId: id,
      adminId: req.user.id
    });

    const transaction = await Transaction.findByPk(id);

    if (!transaction) {
      console.log('Transaction not found for deletion:', id);
      return next(new ApiError('Transaction not found', StatusCodes.NOT_FOUND));
    }

    if (transaction.status === 'completed') {
      console.log('Cannot delete completed transaction:', {
        transactionId: id,
        status: transaction.status
      });
      return next(new ApiError('Cannot delete a completed transaction.', StatusCodes.BAD_REQUEST));
    }

    await transaction.destroy();
    console.log('Transaction deleted successfully:', id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Transaction deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    next(error);
  }
};

/**
 * @desc    Get user's transaction summary/stats
 * @route   GET /api/v1/transactions/summary
 * @access  Private
 */
const getTransactionSummary = async (req, res, next) => {
  try {
    const userId = req.user.role === 'admin' ? req.query.userId : req.user.id;
    
    if (!userId) {
      return next(new ApiError('User ID is required', StatusCodes.BAD_REQUEST));
    }

    const summary = await Transaction.findAll({
      where: {
        [sequelize.Op.or]: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      },
      attributes: [
        'type',
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']
      ],
      group: ['type', 'status'],
      raw: true
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting transaction summary:', error);
    next(error);
  }
};

module.exports = {
  createDepositRequest,
  createWithdrawRequest,
  getTransactions,
  getTransactionById,
  updateTransactionStatus,
  deleteTransaction,
  getTransactionSummary
};