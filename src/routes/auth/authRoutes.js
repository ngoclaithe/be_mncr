const express = require('express');
const router = express.Router();
const authController = require('../../controllers/auth/authController');
const { protect, authorize, handleAdminPromotionAuth } = require('../../middleware/auth');
const { registerValidation,
    loginValidation,
    forgotPasswordValidation,
    resetPasswordValidation } = require('../../middleware/validation/authValidation');
const { updateDetailsValidation,
    changePasswordValidation } = require('../../middleware/validation/userValidation');
const { creatorRegistrationValidation } = require('../../middleware/validation/creatorValidation');
const { promoteToAdminValidation } = require('../../middleware/validation/adminValidation');
const { param } = require('express-validator');
const { Op } = require('sequelize');
// ==================== PUBLIC ROUTES ====================

/**
 * @route   POST /api/v1/auth/register
 * @desc    Đăng ký tài khoản mới
 * @access  Public
 */
router.post('/register',
    registerValidation,
    authController.register
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Đăng nhập
 * @access  Public
 */
router.post('/login',
    loginValidation,
    authController.login
);

/**
 * @route   POST /api/v1/auth/forgotpassword
 * @desc    Quên mật khẩu
 * @access  Public
 */
router.post('/forgotpassword',
    forgotPasswordValidation,
    authController.forgotPassword
);

/**
 * @route   PUT /api/v1/auth/resetpassword/:resettoken
 * @desc    Reset mật khẩu
 * @access  Public
 */
router.put('/resetpassword/:resettoken',
    resetPasswordValidation,
    authController.resetPassword
);

// ==================== PROTECTED ROUTES ====================

/**
 * @route   GET /api/v1/auth/me
 * @desc    Lấy thông tin người dùng hiện tại
 * @access  Private
 */
router.get('/me',
    protect,
    authController.getMe
);

/**
 * @route   PUT /api/v1/auth/updatedetails
 * @desc    Cập nhật thông tin cá nhân
 * @access  Private
 */
router.put('/updatedetails',
    protect,
    updateDetailsValidation,
    authController.updateDetails
);

/**
 * @route   PUT /api/v1/auth/updatepassword
 * @desc    Đổi mật khẩu
 * @access  Private
 */
router.put('/updatepassword',
    protect,
    changePasswordValidation,
    authController.updatePassword
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Đăng xuất
 * @access  Private
 */
router.post('/logout',
    protect,
    authController.logout
);

// ==================== CREATOR ROUTES ====================

/**
 * @route   POST /api/v1/auth/creator/register
 * @desc    Đăng ký trở thành creator
 * @access  Private
 */
router.post('/creator/register',
    protect,
    creatorRegistrationValidation,
    authController.registerCreator
);

/**
 * @route   PUT /api/v1/auth/creator/profile
 * @desc    Cập nhật thông tin creator
 * @access  Private (Creator only)
 */
router.put('/creator/profile',
    protect,
    authorize('creator', 'admin'),
    authController.updateCreatorProfile
);

/**
 * @route   GET /api/v1/auth/creator/profile
 * @desc    Lấy thông tin creator profile
 * @access  Private (Creator only)
 */
router.get('/creator/profile',
    protect,
    authorize('creator', 'admin'),
    authController.getCreatorProfile
);

// ==================== ADMIN ROUTES ====================

/**
 * @route   POST /api/v1/auth/users/:userId/promote-admin
 * @desc    Nâng cấp một user thành admin
 * @access  Private/Admin
 */
router.post('/users/:userId/promote-admin',
    handleAdminPromotionAuth,
    promoteToAdminValidation,
    authController.promoteToAdmin
);

/**
 * @route   GET /api/v1/auth/admin_creator
 * @desc    Admin tạo thông tin creator
 * @access  Private/Admin
 */

router.post('/admin_creator',
    protect,
    authorize('admin'),
    authController.adminCreateCreator
);

/**
 * @route   GET /api/v1/auth/users
 * @desc    Lấy danh sách tất cả users (Admin only)
 * @access  Private/Admin
 */
router.get('/users',
    protect,
    authorize('admin'),
    authController.getAllUsers
);

/**
 * @route   PUT /api/v1/auth/users/:id/toggle-status
 * @desc    Kích hoạt/vô hiệu hóa tài khoản user
 * @access  Private/Admin
 */
router.put('/users/:id/toggle-status',
    protect,
    authorize('admin'),
    param('id').isInt().withMessage('User ID phải là số'),
    authController.toggleUserStatus
);

/**
 * @route   GET /api/v1/auth/check-username/:username
 * @desc    Kiểm tra username có tồn tại không
 * @access  Public
 */
router.get('/check-username/:username',
    param('username')
        .isLength({ min: 3, max: 30 })
        .withMessage('Username phải từ 3-30 ký tự')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username không hợp lệ'),
    authController.checkUsername
);

/**
 * @route   GET /api/v1/auth/check-email/:email
 * @desc    Kiểm tra email có tồn tại không
 * @access  Public
 */
router.get('/check-email/:email',
    param('email').isEmail().withMessage('Email không hợp lệ'),
    authController.checkEmail
);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh JWT token
 * @access  Private
 */
router.post('/refresh-token',
    protect,
    authController.refreshToken
);

module.exports = router;