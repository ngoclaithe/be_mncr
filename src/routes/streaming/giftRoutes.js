const express = require('express');
const router = express.Router();
const giftController = require('../../controllers/streaming/giftController');
const { giftValidation } = require('../../middleware/validation/giftValidation');
const { protect, authorize } = require('../../middleware/auth');

// Middleware xác thực cho tất cả routes
router.use(protect);

// POST /api/stream/gifts - Tạo gift mới (Admin only)
router.post('/', authorize('admin'), giftValidation.createGift, giftController.createGift);

// GET /api/stream/gifts - Lấy danh sách tất cả gifts
router.get('/', giftController.getAllGifts);

// GET /api/stream/gifts/search - Tìm kiếm gifts
router.get('/search', giftController.searchGifts);

// GET /api/stream/gifts/category/:category - Lấy gifts theo category
router.get('/category/:category', giftController.getGiftsByCategory);

// GET /api/stream/gifts/rarity/:rarity - Lấy gifts theo rarity
router.get('/rarity/:rarity', giftValidation.getRarity, giftController.getGiftsByRarity);

// GET /api/stream/gifts/:id - Lấy gift theo ID
router.get('/:id', giftValidation.getGiftById, giftController.getGiftById);

// PUT /api/stream/gifts/:id - Cập nhật gift (Admin only)
router.put('/:id', authorize('admin'), giftValidation.updateGift, giftController.updateGift);

// DELETE /api/stream/gifts/:id - Xóa gift (Admin only)
router.delete('/:id', authorize('admin'), giftValidation.deleteGift, giftController.deleteGift);

module.exports = router;