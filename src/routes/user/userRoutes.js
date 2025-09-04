const express = require('express');
const router = express.Router();
const followController = require('../../controllers/social/followController');
const { protect } = require('../../middleware/auth');
const { userParamIdValidator } = require('../../middleware/validation/followValidation');

// --- Follow Routes ---
router.route('/:userId/follow')
  .post(
    protect,
    userParamIdValidator(),
    followController.toggleFollow
  );

router.route('/:userId/followers')
  .get(userParamIdValidator(), followController.getFollowers);

router.route('/:userId/following')
  .get(userParamIdValidator(), followController.getFollowing);

module.exports = router;
