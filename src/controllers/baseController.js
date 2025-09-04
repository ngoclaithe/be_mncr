const { validationResult } = require('express-validator');

class BaseController {
  constructor(model) {
    this.model = model;
  }

  // Get all records with pagination
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, ...filters } = req.query;
      const offset = (page - 1) * limit;
      
      const whereClause = {};
      // Add filters to whereClause
      Object.keys(filters).forEach(key => {
        if (this.model.rawAttributes[key]) {
          whereClause[key] = filters[key];
        }
      });

      const { count, rows } = await this.model.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      return res.status(200).json({
        success: true,
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error(`Error getting ${this.model.name} list:`, error);
      return res.status(500).json({
        success: false,
        message: `Error getting ${this.model.name} list`
      });
    }
  }

  // Get single record by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const record = await this.model.findByPk(id);
      
      if (!record) {
        return res.status(404).json({
          success: false,
          message: `${this.model.name} not found`
        });
      }

      return res.status(200).json({
        success: true,
        data: record
      });
    } catch (error) {
      console.error(`Error getting ${this.model.name}:`, error);
      return res.status(500).json({
        success: false,
        message: `Error getting ${this.model.name}`
      });
    }
  }

  // Create new record
  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const record = await this.model.create(req.body);
      return res.status(201).json({
        success: true,
        data: record
      });
    } catch (error) {
      console.error(`Error creating ${this.model.name}:`, error);
      return res.status(500).json({
        success: false,
        message: `Error creating ${this.model.name}`,
        error: error.message
      });
    }
  }

  // Update record
  async update(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { id } = req.params;
      const record = await this.model.findByPk(id);
      
      if (!record) {
        return res.status(404).json({
          success: false,
          message: `${this.model.name} not found`
        });
      }

      await record.update(req.body);
      return res.status(200).json({
        success: true,
        data: record
      });
    } catch (error) {
      console.error(`Error updating ${this.model.name}:`, error);
      return res.status(500).json({
        success: false,
        message: `Error updating ${this.model.name}`
      });
    }
  }

  // Delete record
  async delete(req, res) {
    try {
      const { id } = req.params;
      const record = await this.model.findByPk(id);
      
      if (!record) {
        return res.status(404).json({
          success: false,
          message: `${this.model.name} not found`
        });
      }

      await record.destroy();
      return res.status(200).json({
        success: true,
        message: `${this.model.name} deleted successfully`
      });
    } catch (error) {
      console.error(`Error deleting ${this.model.name}:`, error);
      return res.status(500).json({
        success: false,
        message: `Error deleting ${this.model.name}`
      });
    }
  }
}

module.exports = BaseController;
