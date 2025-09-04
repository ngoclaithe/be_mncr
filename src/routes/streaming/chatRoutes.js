const express = require('express');
const { body, param } = require('express-validator');
const chatController = require('../../controllers/streaming/chatController');
const { protect } = require('../../middleware/auth');

const router = express.Router();

// Validation rules
const createMessageValidation = [
    body('streamId')
        .isNumeric() 
        .toInt()      
        .withMessage('StreamId must be a number'),
    body('message')
        .notEmpty()
        .withMessage('Message is required')
        .isLength({ max: 1000 })
        .withMessage('Message must not exceed 1000 characters'),
    body('messageType')
        .isIn(['text', 'gift', 'emoji', 'system'])
        .withMessage('MessageType must be one of: text, gift, emoji, system'),
    body('giftId')
        .optional()
        .isInt({ min: 1 })
        .withMessage('GiftId must be a positive integer'),
    body('quantity')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Quantity must be a positive integer'),
    // Validation tùy chỉnh cho gift messages
    body().custom((value) => {
        if (value.messageType === 'gift') {
            if (!value.giftId) {
                throw new Error('GiftId is required for gift messages');
            }
            if (!value.quantity) {
                throw new Error('Quantity is required for gift messages');
            }
        }
        return true;
    })
];

const getMessagesValidation = [
    param('streamId')
        .isInt({ min: 1 })
        .withMessage('StreamId must be a positive integer')
];

const deleteMessageValidation = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('Message ID must be a positive integer')
];

// Routes
router.post('/', protect, createMessageValidation, chatController.createMessage);
router.get('/:streamId', protect, getMessagesValidation, chatController.getMessages);
router.delete('/:id', protect, deleteMessageValidation, chatController.deleteMessage);

module.exports = router;