const {
  CreatorPackageSubscription,
  StreamPackage,
  Wallet,
  WalletTransaction,
  User,
  sequelize,
} = require('../../models');
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../../utils/ApiError');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

/**
 * @desc    Creator subscribes to a stream package
 * @route   POST /api/v1/subscriptions
 * @access  Private (Creator)
 */
const subscribeToPackage = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({ success: false, errors: errors.array() });
  }

  const { packageId } = req.body;
  const creatorId = req.user.id;

  try {
    const existingSubscription = await CreatorPackageSubscription.findOne({
      where: {
        creatorId,
        status: 'active',
        endDate: { [Op.gt]: new Date() },
      },
    });

    if (existingSubscription) {
      return next(new ApiError('You already have an active subscription.', StatusCodes.BAD_REQUEST));
    }

    const streamPackage = await StreamPackage.findByPk(packageId);
    if (!streamPackage || !streamPackage.isActive) {
      return next(new ApiError('Stream package not found or is not active.', StatusCodes.NOT_FOUND));
    }

    const result = await sequelize.transaction(async (t) => {
      const wallet = await Wallet.findOne({
        where: { userId: creatorId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!wallet || wallet.balance < streamPackage.price) {
        throw new ApiError('Insufficient funds in your wallet.', StatusCodes.BAD_REQUEST);
      }

      await wallet.decrement('balance', { by: streamPackage.price, transaction: t });

      await WalletTransaction.create({
        walletId: wallet.id,
        type: 'package_purchase',
        amount: streamPackage.price,
        description: `Purchase of stream package: ${streamPackage.name}`,
        status: 'completed',
      }, { transaction: t });

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + streamPackage.duration);

      const newSubscription = await CreatorPackageSubscription.create({
        creatorId,
        packageId,
        startDate,
        endDate,
        price: streamPackage.price,
        status: 'active',
      }, { transaction: t });

      return newSubscription;
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Successfully subscribed to the package.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Creator gets their current subscription
 * @route   GET /api/v1/subscriptions/me
 * @access  Private (Creator)
 */
const getMySubscription = async (req, res, next) => {
  try {
    const subscription = await CreatorPackageSubscription.findOne({
      where: {
        creatorId: req.user.id,
        status: 'active',
      },
      include: { model: StreamPackage, as: 'package' },
      order: [['createdAt', 'DESC']],
    });

    if (!subscription) {
      return res.status(StatusCodes.OK).json({
        success: true,
        message: 'No active subscription found.',
        data: null,
      });
    }

    res.status(StatusCodes.OK).json({ success: true, data: subscription });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Creator cancels their subscription
 * @route   PATCH /api/v1/subscriptions/me/cancel
 * @access  Private (Creator)
 */
const cancelSubscription = async (req, res, next) => {
  try {
    const subscription = await CreatorPackageSubscription.findOne({
      where: {
        creatorId: req.user.id,
        status: 'active',
        endDate: { [Op.gt]: new Date() },
      },
    });

    if (!subscription) {
      return next(new ApiError('No active subscription to cancel.', StatusCodes.NOT_FOUND));
    }

    subscription.status = 'cancelled';
    await subscription.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Your subscription has been cancelled.',
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get subscriptions (for Admin or Creator's own)
 * @route   GET /api/v1/subscriptions
 * @access  Private (Admin, Creator)
 */
const getSubscriptions = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const { id: userId, role } = req.user;

    const whereClause = {};
    const include = [{ model: StreamPackage, as: 'package' }];

    if (role === 'admin') {
      const { status, creatorId, packageId } = req.query;
      if (status) whereClause.status = status;
      if (creatorId) whereClause.creatorId = creatorId;
      if (packageId) whereClause.packageId = packageId;
      include.push({ model: User, as: 'creator', attributes: ['id', 'username', 'displayName'] });
    } else {
      whereClause.creatorId = userId;
    }

    const { count, rows } = await CreatorPackageSubscription.findAndCountAll({
      where: whereClause,
      include,
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

module.exports = {
  subscribeToPackage,
  getMySubscription,
  cancelSubscription,
  getSubscriptions,
};
