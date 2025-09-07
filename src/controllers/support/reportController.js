const { User, Creator, Follow, Report } = require('../../models');
const { StatusCodes } = require('http-status-codes');
const { validationResult } = require('express-validator');

// Tạo báo cáo mới
const createReport = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      errors: errors.array()
    });
  }
  
  const currentUser = req.user;
  
  try {
    const { reportedUserId, reason, type, evidence = [] } = req.body;

    // Kiểm tra người dùng có tồn tại không
    const reportedUser = await User.findByPk(reportedUserId);
    if (!reportedUser) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Người dùng được báo cáo không tồn tại'
      });
    }

    // Kiểm tra không thể báo cáo chính mình
    if (currentUser.id === reportedUserId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Không thể báo cáo chính mình'
      });
    }

    // Kiểm tra có báo cáo trùng lặp không (cùng reporter, reported user và type)
    const existingReport = await Report.findOne({
      where: {
        reporterId: currentUser.id,
        reportedUserId,
        type,
        status: ['pending', 'under_review']
      }
    });

    if (existingReport) {
      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: 'Bạn đã báo cáo người dùng này với lý do tương tự'
      });
    }

    // Tạo báo cáo mới
    const report = await Report.create({
      reporterId: currentUser.id,
      reportedUserId,
      type,
      reason,
      evidence,
      status: 'pending'
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Báo cáo đã được tạo thành công',
      data: report
    });
  } catch (error) {
    next(error);
  }
};

// Lấy danh sách báo cáo (cho admin)
const getReports = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      type,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {};

    // Filter theo status
    if (status) {
      whereClause.status = status;
    }

    // Filter theo type
    if (type) {
      whereClause.type = type;
    }

    const reports = await Report.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'reporter',
          attributes: ['id', 'username', 'email', 'avatar']
        },
        {
          model: User,
          as: 'reportedUser', 
          attributes: ['id', 'username', 'email', 'avatar']
        },
        {
          model: User,
          as: 'resolver',
          attributes: ['id', 'username', 'email'],
          required: false
        }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        reports: reports.rows,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(reports.count / limit),
          count: reports.count,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Lấy chi tiết một báo cáo
const getReportById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const report = await Report.findByPk(id, {
      include: [
        {
          model: User,
          as: 'reporter',
          attributes: ['id', 'username', 'email', 'avatar']
        },
        {
          model: User,
          as: 'reportedUser',
          attributes: ['id', 'username', 'email', 'avatar']
        },
        {
          model: User,
          as: 'resolver',
          attributes: ['id', 'username', 'email'],
          required: false
        }
      ]
    });

    if (!report) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Báo cáo không tồn tại'
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

// Cập nhật trạng thái báo cáo (cho admin)
const updateReportStatus = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { id } = req.params;
    const { status, adminNotes, actionTaken } = req.body;
    const currentAdmin = req.user;

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Báo cáo không tồn tại'
      });
    }

    const updateData = {
      status,
      adminNotes,
      actionTaken
    };

    // Nếu trạng thái là resolved hoặc dismissed, cập nhật thông tin resolver
    if (status === 'resolved' || status === 'dismissed') {
      updateData.resolvedBy = currentAdmin.id;
      updateData.resolvedAt = new Date();
    }

    await report.update(updateData);

    // Fetch updated report with associations
    const updatedReport = await Report.findByPk(id, {
      include: [
        {
          model: User,
          as: 'reporter',
          attributes: ['id', 'username', 'email']
        },
        {
          model: User,
          as: 'reportedUser',
          attributes: ['id', 'username', 'email']
        },
        {
          model: User,
          as: 'resolver',
          attributes: ['id', 'username', 'email'],
          required: false
        }
      ]
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Cập nhật báo cáo thành công',
      data: updatedReport
    });
  } catch (error) {
    next(error);
  }
};

// Lấy báo cáo của người dùng hiện tại
const getMyReports = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const currentUser = req.user;
    const offset = (page - 1) * limit;

    const reports = await Report.findAndCountAll({
      where: {
        reporterId: currentUser.id
      },
      include: [
        {
          model: User,
          as: 'reportedUser',
          attributes: ['id', 'username', 'avatar']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        reports: reports.rows,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(reports.count / limit),
          count: reports.count,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Xóa báo cáo (chỉ người tạo có thể xóa khi status là pending)
const deleteReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Báo cáo không tồn tại'
      });
    }

    // Chỉ cho phép xóa báo cáo của chính mình và đang ở trạng thái pending
    if (report.reporterId !== currentUser.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Bạn không có quyền xóa báo cáo này'
      });
    }

    if (report.status !== 'pending') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Chỉ có thể xóa báo cáo đang ở trạng thái chờ xử lý'
      });
    }

    await report.destroy();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Xóa báo cáo thành công'
    });
  } catch (error) {
    next(error);
  }
};

// Thống kê báo cáo (cho admin)
const getReportStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          [Op.gte]: new Date(startDate),
          [Op.lte]: new Date(endDate)
        }
      };
    }

    // Thống kê theo status
    const statusStats = await Report.findAll({
      where: dateFilter,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    // Thống kê theo type
    const typeStats = await Report.findAll({
      where: dateFilter,
      attributes: [
        'type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['type']
    });

    // Tổng số báo cáo
    const totalReports = await Report.count({
      where: dateFilter
    });

    // Báo cáo theo thời gian (theo ngày)
    const dailyStats = await Report.findAll({
      where: dateFilter,
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']]
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        total: totalReports,
        byStatus: statusStats,
        byType: typeStats,
        daily: dailyStats
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReport,
  getReports,
  getReportById,
  updateReportStatus,
  getMyReports,
  deleteReport,
  getReportStats
};