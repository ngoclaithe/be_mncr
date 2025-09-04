const { body, query } = require('express-validator');

// Tạo conversation
const createConversationValidation = [
    body('receiverId')
        .notEmpty()
        .withMessage('Receiver ID là bắt buộc')
        .isInt({ min: 1 })
        .withMessage('Receiver ID phải là số nguyên dương')
];

// Lấy danh sách conversations
const getConversationsValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page phải là số nguyên dương')
        .toInt()
        .default(1),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Limit phải từ 1 đến 50')
        .toInt()
        .default(20),

    query('search')
        .optional()
        .isLength({ max: 255 })
        .withMessage('Search không được vượt quá 255 ký tự')
];

// Block conversation
const blockConversationValidation = [
    body('isBlocked')
        .notEmpty()
        .withMessage('isBlocked là bắt buộc')
        .isBoolean()
        .withMessage('isBlocked phải là boolean')
        .toBoolean()
];

// Mute conversation
const muteConversationValidation = [
    body('isMuted')
        .notEmpty()
        .withMessage('isMuted là bắt buộc')
        .isBoolean()
        .withMessage('isMuted phải là boolean')
        .toBoolean()
];

module.exports = {
    createConversationValidation,
    getConversationsValidation,
    blockConversationValidation,
    muteConversationValidation
};
