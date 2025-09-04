const express = require('express');
const router = express.Router();
const infoPaymentController = require('../../controllers/payment/infoPaymentController');
const { protect, authorize } = require('../../middleware/auth');
const {
  createInfoPaymentValidator,
  updateInfoPaymentValidator
} = require('../../middleware/validation/infoPaymentValidation');

/**
 * @route   GET /api/v1/info-payments/public
 * @desc    Lấy danh sách các phương thức thanh toán đang hoạt động
 * @access  Private (Bất kỳ người dùng nào đã đăng nhập)
 */
router.get(
  '/public',
  protect,
  infoPaymentController.getPublicActivePayments
);

// --- CÁC ROUTE DÀNH CHO ADMIN ---
// Tất cả các route bên dưới đều yêu cầu đăng nhập và có quyền admin.
router.use(protect, authorize('admin'));

router.route('/')
  .get(infoPaymentController.getAll)
  .post(createInfoPaymentValidator, infoPaymentController.create);

router.route('/:id')
  .get(infoPaymentController.getById)
  .put(updateInfoPaymentValidator, infoPaymentController.update)
  .delete(infoPaymentController.delete);

module.exports = router;