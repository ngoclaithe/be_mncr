const { body, param, query } = require('express-validator');

const giftValidation = {
    // Validation cho tạo gift mới
    createGift: [
        body('name')
            .notEmpty()
            .withMessage('Gift name is required')
            .isLength({ min: 1, max: 100 })
            .withMessage('Gift name must be between 1 and 100 characters')
            .trim(),
        
        body('description')
            .optional()
            .isLength({ max: 500 })
            .withMessage('Description must not exceed 500 characters')
            .trim(),
        
        body('imageUrl')
            .optional()
            .isLength({ max: 500 })
            .withMessage('Image URL must not exceed 500 characters'),
        
        body('animationUrl')
            .optional()
            .isLength({ max: 500 })
            .withMessage('Animation URL must not exceed 500 characters'),
        
        body('price')
            .notEmpty()
            .withMessage('Price is required')
            .isInt({ min: 1 })
            .withMessage('Price must be a positive integer'),
        
        body('category')
            .optional()
            .isLength({ max: 50 })
            .withMessage('Category must not exceed 50 characters')
            .trim(),
        
        body('rarity')
            .optional()
            .isIn(['common', 'rare', 'epic', 'legendary'])
            .withMessage('Rarity must be one of: common, rare, epic, legendary')
    ],

    // Validation cho cập nhật gift
    updateGift: [
        param('id')
            .isInt({ min: 1 })
            .withMessage('Gift ID must be a positive integer'),
        
        body('name')
            .optional()
            .isLength({ min: 1, max: 100 })
            .withMessage('Gift name must be between 1 and 100 characters')
            .trim(),
        
        body('description')
            .optional()
            .isLength({ max: 500 })
            .withMessage('Description must not exceed 500 characters')
            .trim(),
        
        body('imageUrl')
            .optional()
            .isURL()
            .withMessage('Image URL must be a valid URL'),
        
        body('animationUrl')
            .optional()
            .isURL()
            .withMessage('Animation URL must be a valid URL'),
        
        body('price')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Price must be a positive integer'),
        
        body('category')
            .optional()
            .isLength({ max: 50 })
            .withMessage('Category must not exceed 50 characters')
            .trim(),
        
        body('rarity')
            .optional()
            .isIn(['common', 'rare', 'epic', 'legendary'])
            .withMessage('Rarity must be one of: common, rare, epic, legendary'),
        
        body('isActive')
            .optional()
            .isBoolean()
            .withMessage('isActive must be a boolean value')
    ],

    // Validation cho lấy gift theo ID
    getGiftById: [
        param('id')
            .isInt({ min: 1 })
            .withMessage('Gift ID must be a positive integer')
    ],

    // Validation cho xóa gift
    deleteGift: [
        param('id')
            .isInt({ min: 1 })
            .withMessage('Gift ID must be a positive integer')
    ],

    // Validation cho lấy gifts theo rarity
    getRarity: [
        param('rarity')
            .isIn(['common', 'rare', 'epic', 'legendary'])
            .withMessage('Rarity must be one of: common, rare, epic, legendary')
    ],

    // Validation cho search gifts
    searchGifts: [
        query('q')
            .optional()
            .isLength({ min: 1, max: 100 })
            .withMessage('Search query must be between 1 and 100 characters')
            .trim(),
        
        query('category')
            .optional()
            .isLength({ max: 50 })
            .withMessage('Category must not exceed 50 characters')
            .trim(),
        
        query('rarity')
            .optional()
            .isIn(['common', 'rare', 'epic', 'legendary'])
            .withMessage('Rarity must be one of: common, rare, epic, legendary'),
        
        query('minPrice')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Minimum price must be a non-negative integer'),
        
        query('maxPrice')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Maximum price must be a non-negative integer'),
        
        query('isActive')
            .optional()
            .isBoolean()
            .withMessage('isActive must be a boolean value')
    ]
};

module.exports = { giftValidation };