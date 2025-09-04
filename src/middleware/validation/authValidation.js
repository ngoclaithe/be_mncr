// validation/authValidation.js
const { body, param } = require('express-validator');

// Register validation
const registerValidation = [
    body('email')
        .isEmail()
        .withMessage('Email không hợp lệ')
        .normalizeEmail(),
    body('username')
        .isLength({ min: 3, max: 30 })
        .withMessage('Username phải từ 3-30 ký tự')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username chỉ được chứa chữ cái, số và dấu gạch dưới'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Mật khẩu phải có ít nhất 8 ký tự')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/)
        .withMessage('Mật khẩu phải chứa chữ hoa, thường, số và ký tự đặc biệt'),
    body('firstName')
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage('Tên phải từ 2-50 ký tự')
        .trim(),
    body('lastName')
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage('Họ phải từ 2-50 ký tự')
        .trim(),
    body('phoneNumber')
        .optional()
        .isMobilePhone()
        .withMessage('Số điện thoại không hợp lệ'),
    body('gender')
        .optional()
        .isIn(['male', 'female', 'other'])
        .withMessage('Giới tính phải là male, female hoặc other'),
    body('dateOfBirth')
        .optional()
        .isISO8601()
        .withMessage('Ngày sinh không hợp lệ'),
    body('referralCode')
        .optional()
        .isLength({ min: 8, max: 16 })
        .withMessage('Mã giới thiệu không hợp lệ')
];

// Login validation
const loginValidation = [
    body('loginField')
        .notEmpty()
        .withMessage('Email hoặc username là bắt buộc'),
    body('password')
        .notEmpty()
        .withMessage('Mật khẩu là bắt buộc')
];

// Forgot password validation
const forgotPasswordValidation = [
    body('email')
        .isEmail()
        .withMessage('Email không hợp lệ')
        .normalizeEmail()
];

// Reset password validation
const resetPasswordValidation = [
    param('resettoken')
        .isLength({ min: 40, max: 40 })
        .withMessage('Reset token không hợp lệ'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Mật khẩu phải có ít nhất 8 ký tự')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/)
        .withMessage('Mật khẩu phải chứa chữ hoa, thường, số và ký tự đặc biệt')
];

module.exports = {
    registerValidation,
    loginValidation,
    forgotPasswordValidation,
    resetPasswordValidation
};