const { body } = require('express-validator');

const updateDetailsValidation = [
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
    body('country')
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage('Tên quốc gia không hợp lệ'),
    body('city')
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage('Tên thành phố không hợp lệ'),
    body('avatar')
        .optional()
        .isURL()
        .withMessage('Avatar phải là URL hợp lệ')
        .isLength({ max: 500 })
        .withMessage('URL avatar không được quá 500 ký tự'),
    body('timezone')
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage('Timezone không hợp lệ'),
    body('language')
        .optional()
        .isLength({ min: 2, max: 10 })
        .withMessage('Language code không hợp lệ')
];

const changePasswordValidation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Mật khẩu hiện tại là bắt buộc'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('Mật khẩu mới phải có ít nhất 8 ký tự')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/)
        .withMessage('Mật khẩu mới phải chứa chữ hoa, thường, số và ký tự đặc biệt')
];

module.exports = {
    updateDetailsValidation,
    changePasswordValidation
};