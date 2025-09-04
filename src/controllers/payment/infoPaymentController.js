const { InfoPayment } = require('../../models');
const { StatusCodes } = require('http-status-codes');
const { validationResult } = require('express-validator');
const ApiError = require('../../utils/ApiError');

class InfoPaymentController {
  /**
   * @desc    Get all payment info (for Admin)
   * @route   GET /api/v1/info-payments
   * @access  Private (Admin)
   */
  async getAll(req, res, next) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;

      const { count, rows } = await InfoPayment.findAndCountAll({
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
          totalPages: Math.ceil(count / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get single payment info by ID (for Admin)
   * @route   GET /api/v1/info-payments/:id
   * @access  Private (Admin)
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const paymentInfo = await InfoPayment.findByPk(id);

      if (!paymentInfo) {
        return next(new ApiError('Payment information not found', StatusCodes.NOT_FOUND));
      }

      res.status(StatusCodes.OK).json({
        success: true,
        data: paymentInfo,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Create new payment info (for Admin)
   * @route   POST /api/v1/info-payments
   * @access  Private (Admin)
   */
  async create(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, errors: errors.array() });
    }

    try {
      const newPaymentInfo = await InfoPayment.create(req.body);
      res.status(StatusCodes.CREATED).json({
        success: true,
        data: newPaymentInfo,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get all active payment info for public use
   * @route   GET /api/v1/info-payments/public
   * @access  Private (Any authenticated user)
   */
  async getPublicActivePayments(req, res, next) {
    try {
      const activePayments = await InfoPayment.findAll({
        where: { isActive: true }, 
        attributes: { exclude: ['createdAt', 'updatedAt'] },
        order: [['bankName', 'ASC']], 
      });

      res.status(StatusCodes.OK).json({
        success: true,
        data: activePayments,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update payment info (for Admin)
   * @route   PUT /api/v1/info-payments/:id
   * @access  Private (Admin)
   */
  async update(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const paymentInfo = await InfoPayment.findByPk(id);

      if (!paymentInfo) {
        return next(new ApiError('Payment information not found', StatusCodes.NOT_FOUND));
      }

      await paymentInfo.update(req.body);
      res.status(StatusCodes.OK).json({
        success: true,
        data: paymentInfo,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Delete payment info (for Admin)
   * @route   DELETE /api/v1/info-payments/:id
   * @access  Private (Admin)
   */
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const paymentInfo = await InfoPayment.findByPk(id);

      if (!paymentInfo) {
        return next(new ApiError('Payment information not found', StatusCodes.NOT_FOUND));
      }

      await paymentInfo.destroy();
      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Payment information deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new InfoPaymentController();