const express = require('express');
const router = express.Router();
const conversationController = require('../../controllers/chatprivate/conversationController');
const { validateRequest } = require('../../middleware/validation');
const { protect } = require('../../middleware/auth');
const {
  createConversationValidation,
  getConversationsValidation,
  blockConversationValidation,
  muteConversationValidation
} = require('../../middleware/validation/conversationValidation');

// GET /api/conversations - Lấy danh sách conversations
router.get(
  '/',
  protect,
  getConversationsValidation,
  conversationController.getConversations
);

// POST /api/conversations - Tạo conversation mới
router.post(
  '/',
  protect,
  createConversationValidation,
  conversationController.createConversation
);

// GET /api/conversations/:id - Lấy chi tiết conversation
router.get(
  '/:id',
  protect,
  conversationController.getConversationById
);

// PUT /api/conversations/:id/block - Block/unblock conversation
router.put(
  '/:id/block',
  protect,
  blockConversationValidation,
  conversationController.blockConversation
);

// PUT /api/conversations/:id/mute - Mute/unmute conversation
router.put(
  '/:id/mute',
  protect,
  muteConversationValidation,
  conversationController.muteConversation
);

// DELETE /api/conversations/:id - Delete conversation
router.delete(
  '/:id',
  protect,
  conversationController.deleteConversation
);

module.exports = router;