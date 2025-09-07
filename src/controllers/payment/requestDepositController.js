const { RequestDeposit, InfoPayment, User, Wallet, sequelize } = require('../../models');
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../../utils/ApiError');
const { validationResult } = require('express-validator');

/**
 * @desc    Create a new deposit request
 * @route   POST /api/v1/request-deposits
 * @access  Private (User)
 */
const createRequest = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({ success: false, errors: errors.array() });
  }

  try {
    const { amount, infoPaymentId, codePay, metadata } = req.body;
    const userId = req.user.id;

    console.log('Creating deposit request:', {
      userId,
      amount,
      infoPaymentId,
      codePay,
      metadata
    });

    const newRequest = await RequestDeposit.create({
      userId,
      amount,
      infoPaymentId,
      codePay,
      status: 'pending',
      metadata: metadata || null,
      createdAt: new Date(),
    });

    console.log('Deposit request created successfully:', newRequest.toJSON());

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Deposit request created successfully. Please wait for admin approval.',
      data: newRequest,
    });
  } catch (error) {
    console.error('Error creating deposit request:', error);
    next(error);
  }
};

/**
 * @desc    Get all deposit requests (for Admin) or user's own requests
 * @route   GET /api/v1/request-deposits
 * @access  Private
 */
const getRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, userId } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (req.user.role !== 'admin') {
      whereClause.userId = req.user.id;
    } else if (userId) {
      whereClause.userId = userId;
    }

    if (status) {
      whereClause.status = status;
    }

    console.log('Getting deposit requests with filters:', {
      whereClause,
      page,
      limit,
      userRole: req.user.role
    });

    const { count, rows } = await RequestDeposit.findAndCountAll({
      where: whereClause,
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: InfoPayment, as: 'infoPayment' },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
    });

    console.log(`Found ${count} deposit requests`);

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
    console.error('Error getting deposit requests:', error);
    next(error);
  }
};

/**
 * @desc    Get a single deposit request by ID
 * @route   GET /api/v1/request-deposits/:id
 * @access  Private
 */
const getRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('Getting deposit request by ID:', id);

    const request = await RequestDeposit.findByPk(id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: InfoPayment, as: 'infoPayment' },
      ],
    });

    if (!request) {
      console.log('Deposit request not found:', id);
      return res.status(StatusCodes.OK).json({
        success: true,
        data: null,
        message: 'Deposit request not found'
      });
    }

    if (req.user.role !== 'admin' && request.userId !== req.user.id) {
      console.log('Unauthorized access attempt:', {
        requestUserId: request.userId,
        currentUserId: req.user.id,
        userRole: req.user.role
      });
      return next(new ApiError('You are not authorized to view this request', StatusCodes.FORBIDDEN));
    }

    console.log('Deposit request found:', request.toJSON());

    res.status(StatusCodes.OK).json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error('Error getting deposit request by ID:', error);
    next(error);
  }
};

/**
 * @desc    Update a deposit request status (for Admin)
 * @route   PATCH /api/v1/request-deposits/:id
 * @access  Private (Admin)
 */
const updateRequestStatus = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({ success: false, errors: errors.array() });
  }

  const { id } = req.params;
  const { status, metadata } = req.body;

  try {
    console.log('Updating deposit request status:', {
      requestId: id,
      newStatus: status,
      metadata,
      adminId: req.user.id
    });

    const request = await RequestDeposit.findByPk(id);

    if (!request) {
      console.log('Deposit request not found:', id);
      return next(new ApiError('Deposit request not found', StatusCodes.NOT_FOUND));
    }

    if (request.status !== 'pending') {
      console.log('Cannot update non-pending request:', {
        requestId: id,
        currentStatus: request.status,
        attemptedStatus: status
      });
      return next(new ApiError(`Cannot update a request that is already ${request.status}`, StatusCodes.BAD_REQUEST));
    }

    console.log('✅ Status check passed, proceeding with transaction...');
    console.log('Processing status update for request:', request.toJSON());

    const result = await sequelize.transaction(async (t) => {
      console.log('🔄 Transaction started');
      
      // Update request status
      console.log('Updating request status and metadata...');
      request.status = status;
      request.metadata = metadata || request.metadata;
      await request.save({ transaction: t });

      console.log('✅ Request status updated successfully:', {
        requestId: id,
        newStatus: status,
        amount: request.amount
      });

      // If approved/completed, update wallet tokens
      if (status === 'completed' || status === 'approved') {
        console.log('🪙 Processing wallet update for completed/approved request...');
        console.log('Target user ID:', request.userId);
        
        // Find or create user wallet
        console.log('🔍 Finding wallet for user:', request.userId);
        let wallet = await Wallet.findOne({ 
          where: { userId: request.userId },
          transaction: t 
        });

        console.log('Wallet query result:', wallet ? wallet.toJSON() : 'null');

        if (!wallet) {
          console.log('🆕 Creating new wallet for user:', request.userId);
          wallet = await Wallet.create({ 
            userId: request.userId,
            balance: 0,
            tokens: 0,
            totalDeposited: 0
          }, { transaction: t });
          console.log('✅ New wallet created:', wallet.toJSON());
        }

        // Calculate tokens (1000 VND = 1 token)
        const tokensToAdd = Math.floor(request.amount / 1000);
        const previousTokens = wallet.tokens || 0;
        const previousTotalDeposited = wallet.totalDeposited || 0;

        console.log('💰 Token calculation:', {
          depositAmount: request.amount,
          amountType: typeof request.amount,
          tokensToAdd,
          tokensToAddType: typeof tokensToAdd,
          previousTokens,
          previousTokensType: typeof previousTokens,
          newTokens: previousTokens + tokensToAdd,
          conversionRate: '1000 VND = 1 token'
        });

        // Validate calculation
        if (isNaN(tokensToAdd) || tokensToAdd < 0) {
          console.error('❌ Invalid token calculation:', {
            tokensToAdd,
            depositAmount: request.amount
          });
          throw new Error('Invalid token calculation');
        }

        // Update wallet tokens and total deposited
        console.log('🔄 Updating wallet with increment...');
        await wallet.increment({
          tokens: tokensToAdd,
          totalDeposited: request.amount
        }, { transaction: t });

        // Fetch updated wallet data
        await wallet.reload({ transaction: t });

        console.log('✅ Wallet updated successfully:', {
          userId: request.userId,
          previousTokens,
          tokensAdded: tokensToAdd,
          newTokens: wallet.tokens,
          previousTotalDeposited,
          newTotalDeposited: wallet.totalDeposited,
          depositAmount: request.amount
        });
      } else {
        console.log('ℹ️ Status is not completed/approved, skipping wallet update');
      }

      console.log('🔄 Transaction completing...');
      return request;
    });

    console.log('✅ Transaction completed successfully:', {
      requestId: id,
      finalStatus: result.status
    });

    console.log('📤 Sending response...');
    res.status(StatusCodes.OK).json({
      success: true,
      message: `Request has been ${status}.`,
      data: result,
    });

    console.log('=== UPDATE REQUEST STATUS SUCCESS ===');
  } catch (error) {
    console.error('❌ ERROR in updateRequestStatus:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.log('=== UPDATE REQUEST STATUS FAILED ===');
    next(error);
  }
};

/**
 * @desc    Delete a deposit request (for Admin)
 * @route   DELETE /api/v1/request-deposits/:id
 * @access  Private (Admin)
 */
const deleteRequest = async (req, res, next) => {
  console.log('🚀 deleteRequest FUNCTION CALLED!');
  try {
    const { id } = req.params;
    console.log('Deleting deposit request:', {
      requestId: id,
      adminId: req.user.id
    });

    const request = await RequestDeposit.findByPk(id);

    if (!request) {
      console.log('Deposit request not found for deletion:', id);
      return next(new ApiError('Deposit request not found', StatusCodes.NOT_FOUND));
    }

    if (request.status === 'completed') {
      console.log('Cannot delete completed request:', {
        requestId: id,
        status: request.status
      });
      return next(new ApiError('Cannot delete a completed request.', StatusCodes.BAD_REQUEST));
    }

    await request.destroy();
    console.log('Deposit request deleted successfully:', id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Deposit request deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting deposit request:', error);
    next(error);
  }
};

module.exports = {
  createRequest,
  getRequests,
  getRequestById,
  updateRequestStatus,
  deleteRequest,
};