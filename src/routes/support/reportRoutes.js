const express = require('express');
const reportController = require('../../controllers/support/reportController');
const { protect, authorize } = require('../../middleware/auth');
const {
  createReportValidation,
  getReportsValidation,
  getMyReportsValidation,
  getReportStatsValidation,
  reportIdValidation,
  updateReportStatusValidation
} = require('../../middleware/validation/reportValidation');

const router = express.Router();

// Tạo báo cáo mới
router.post('/', protect, createReportValidation, reportController.createReport);

// Lấy danh sách báo cáo (cho admin)
router.get('/', protect, authorize('admin'), getReportsValidation, reportController.getReports);

// Lấy báo cáo của người dùng hiện tại
router.get('/me', protect, getMyReportsValidation, reportController.getMyReports);

// Thống kê báo cáo (cho admin)
router.get('/stats', protect, authorize('admin'), getReportStatsValidation, reportController.getReportStats);

// Lấy chi tiết một báo cáo
router.get('/:id', protect, reportIdValidation, reportController.getReportById);

// Cập nhật trạng thái báo cáo (cho admin)
router.put('/:id', protect, authorize('admin'), updateReportStatusValidation, reportController.updateReportStatus);

// Xóa báo cáo
router.delete('/:id', protect, reportIdValidation, reportController.deleteReport);

module.exports = router;