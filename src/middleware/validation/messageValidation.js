const { body, query } = require('express-validator');

// Tạo message
const createMessageValidation = [
    body('messageType')
        .optional()
        .isIn(['text', 'image', 'video', 'gift', 'audio'])
        .withMessage('Loại tin nhắn không hợp lệ')
        .default('text'),

    body('content')
        .if(body('messageType').equals('text'))
        .notEmpty()
        .withMessage('Nội dung là bắt buộc cho tin nhắn text')
        .isLength({ max: 10000 })
        .withMessage('Nội dung không được vượt quá 10000 ký tự'),

    body('mediaUrl')
        .if(body('messageType').isIn(['image', 'video', 'gift', 'audio']))
        .notEmpty()
        .withMessage('Media URL là bắt buộc cho tin nhắn media')
        .isURL()
        .withMessage('Media URL không hợp lệ')
];

// Lấy messages (query)
const getMessagesValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page phải là số nguyên dương')
        .toInt()
        .default(1),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit phải từ 1 đến 100')
        .toInt()
        .default(50),

    query('before')
        .optional()
        .isISO8601()
        .withMessage('Before phải là ngày hợp lệ'),

    query('after')
        .optional()
        .isISO8601()
        .withMessage('After phải là ngày hợp lệ'),

    query('messageType')
        .optional()
        .isIn(['text', 'image', 'video', 'gift'])
        .withMessage('Loại tin nhắn không hợp lệ')
];

// Reaction
const reactToMessageValidation = [
    body('emoji')
        .notEmpty()
        .withMessage('Emoji là bắt buộc')
        .isLength({ max: 10 })
        .withMessage('Emoji không được vượt quá 10 ký tự')
];

module.exports = {
    createMessageValidation,
    getMessagesValidation,
    reactToMessageValidation
};
