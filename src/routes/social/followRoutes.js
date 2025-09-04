const express = require('express');
const router = express.Router();
const followController = require('../../controllers/social/followController');
const { protect } = require('../../middleware/auth');
const { userParamIdValidator } = require('../../middleware/validation/followValidation');

// Route để theo dõi hoặc hủy theo dõi một người dùng.
router.route('/:userId/toggle')
  .post(
    protect,
    userParamIdValidator(),
    followController.toggleFollow
  );

// Route để lấy danh sách những người theo dõi (followers) của một người dùng.
router.route('/:userId/followers')
  .get(userParamIdValidator(), followController.getFollowers);

// Route để lấy danh sách những người mà một người dùng đang theo dõi (following).
router.route('/:userId/following')
  .get(userParamIdValidator(), followController.getFollowing);

module.exports = router;
