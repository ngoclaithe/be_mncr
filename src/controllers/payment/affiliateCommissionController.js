const BaseController = require('../baseController');
const { AffiliateCommission } = require('../../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

class AffiliateCommissionController extends BaseController {
  constructor() {
    super(AffiliateCommission);
  }

  // Override the create method to include custom logic for affiliate commissions
  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { affiliateUserId, referredUserId, transactionId, commissionRate, commissionAmount } = req.body;
      
      // Check if commission already exists for this transaction
      const existingCommission = await AffiliateCommission.findOne({
        where: { transactionId }
      });

      if (existingCommission) {
        return res.status(400).json({
          success: false,
          message: 'Commission for this transaction already exists'
        });
      }

      // Create the commission
      const commission = await AffiliateCommission.create({
        affiliateUserId,
        referredUserId,
        transactionId,
        commissionRate,
        commissionAmount,
        status: 'pending'
      });

      return res.status(201).json({
        success: true,
        data: commission
      });
    } catch (error) {
      console.error('Error creating affiliate commission:', error);
      return res.status(500).json({
        success: false,
        message: 'Error creating affiliate commission',
        error: error.message
      });
    }
  }

  // Get commissions by affiliate user ID
  async getByAffiliateUserId(req, res) {
    try {
      const { userId } = req.params;
      const { status, startDate, endDate } = req.query;
      
      const whereClause = { affiliateUserId: userId };
      
      if (status) {
        whereClause.status = status;
      }
      
      if (startDate && endDate) {
        whereClause.createdAt = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }

      const commissions = await AffiliateCommission.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']]
      });

      return res.status(200).json({
        success: true,
        data: commissions
      });
    } catch (error) {
      console.error('Error getting affiliate commissions:', error);
      return res.status(500).json({
        success: false,
        message: 'Error getting affiliate commissions'
      });
    }
  }

  // Update commission status
  async updateStatus(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const commission = await AffiliateCommission.findByPk(id);
      
      if (!commission) {
        return res.status(404).json({
          success: false,
          message: 'Commission not found'
        });
      }

      // Update status and set paidAt if status is 'paid'
      const updateData = { status };
      if (status === 'paid' && !commission.paidAt) {
        updateData.paidAt = new Date();
      }

      await commission.update(updateData);
      
      return res.status(200).json({
        success: true,
        data: commission
      });
    } catch (error) {
      console.error('Error updating commission status:', error);
      return res.status(500).json({
        success: false,
        message: 'Error updating commission status'
      });
    }
  }
}

module.exports = new AffiliateCommissionController();
