const express = require('express');
const router = express.Router();
const messageController = require('../../controllers/chatprivate/messageController');
const { validateRequest } = require('../../middleware/validation');
const { protect } = require('../../middleware/auth');
const {
  createMessageValidation,
  getMessagesValidation,
  reactToMessageValidation
} = require('../../middleware/validation/messageValidation');

// GET /api/conversations/:conversationId/messages - Lấy messages trong conversation
router.get(
  '/conversations/:conversationId/messages',
  protect,
  getMessagesValidation,
  messageController.getMessages
);

// POST /api/conversations/:conversationId/messages - Tạo message mới
router.post(
  '/conversations/:conversationId/messages',
  protect,
  createMessageValidation,
  messageController.createMessage
);

// GET /api/messages/:id - Lấy chi tiết message
router.get(
  '/messages/:id',
  protect,
  messageController.getMessageById
);

// PUT /api/messages/:id/react - React to message
router.put(
  '/messages/:id/react',
  protect,
  reactToMessageValidation,
  messageController.reactToMessage
);

// DELETE /api/messages/:id - Delete message
router.delete(
  '/messages/:id',
  protect,
  messageController.deleteMessage
);

module.exports = router;