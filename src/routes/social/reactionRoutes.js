const express = require('express');
const router = express.Router({ mergeParams: true });
const reactionController = require('../../controllers/social/reactionController');
const { protect } = require('../../middleware/auth');
const { toggleReactionValidator } = require('../../middleware/validation/reactionValidation');

router.route('/')
  .post(
    protect,
    toggleReactionValidator,
    reactionController.toggleReaction
  );

module.exports = router;