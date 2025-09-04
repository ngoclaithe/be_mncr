const BaseController = require('../baseController');
const { StreamPackage } = require('../../models');

class StreamPackageController extends BaseController {
  constructor() {
    super(StreamPackage);
  }

  // Override getAll to handle role-based access
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};

      // If the user is a creator, only show active packages
      if (req.user.role === 'creator') {
        whereClause.isActive = true;
      }

      const { count, rows } = await this.model.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['price', 'ASC']],
      });

      return res.status(200).json({
        success: true,
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          totalPages: Math.ceil(count / limit),
        },
      });
    } catch (error) {
      console.error(`Error getting ${this.model.name} list:`, error);
      return res.status(500).json({
        success: false,
        message: `Error getting ${this.model.name} list`,
      });
    }
  }
}

module.exports = new StreamPackageController();