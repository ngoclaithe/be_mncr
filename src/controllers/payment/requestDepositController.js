const { RequestDeposit, InfoPayment, User, sequelize } = require('../../models');
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

    const newRequest = await RequestDeposit.create({
      userId,
      amount,
      infoPaymentId,
      codePay,
      status: 'pending',
      metadata: metadata || null,
      createdAt: new Date(),
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Deposit request created successfully. Please wait for admin approval.',
      data: newRequest,
    });
  } catch (error) {
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
 * @desc    Get a single deposit request by ID
 * @route   GET /api/v1/request-deposits/:id
 * @access  Private
 */
const getRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await RequestDeposit.findByPk(id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: InfoPayment, as: 'infoPayment' },
      ],
    });

    if (!request) {
      return res.status(StatusCodes.OK).json({
        success: true,
        data: null,
        message: 'Deposit request not found'
      });
    }

    if (req.user.role !== 'admin' && request.userId !== req.user.id) {
      return next(new ApiError('You are not authorized to view this request', StatusCodes.FORBIDDEN));
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: request,
    });
  } catch (error) {
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
    const request = await RequestDeposit.findByPk(id);

    if (!request) {
      return next(new ApiError('Deposit request not found', StatusCodes.NOT_FOUND));
    }

    if (request.status !== 'pending') {
      return next(new ApiError(`Cannot update a request that is already ${request.status}`, StatusCodes.BAD_REQUEST));
    }

    const result = await sequelize.transaction(async (t) => {
      request.status = status;
      request.metadata = metadata || request.metadata;
      await request.save({ transaction: t });

      if (status === 'completed') {
        const user = await User.findByPk(request.userId, { transaction: t });
        if (!user) {
          throw new ApiError('User associated with this request not found.', StatusCodes.NOT_FOUND);
        }
        await user.increment('balance', { by: request.amount, transaction: t });
      }
      return request;
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Request has been ${status}.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a deposit request (for Admin)
 * @route   DELETE /api/v1/request-deposits/:id
 * @access  Private (Admin)
 */
const deleteRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await RequestDeposit.findByPk(id);

    if (!request) {
      return next(new ApiError('Deposit request not found', StatusCodes.NOT_FOUND));
    }

    if (request.status === 'completed') {
      return next(new ApiError('Cannot delete a completed request.', StatusCodes.BAD_REQUEST));
    }

    await request.destroy();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Deposit request deleted successfully.',
    });
  } catch (error) {
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