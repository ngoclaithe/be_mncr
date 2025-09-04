const express = require('express');
const router = express.Router();
const followController = require('../../controllers/creator/followController');
const { authorize } = require('../../middleware/auth');
const { removeFollowerValidator } = require('../../middleware/validation/creatorValidation');

// All routes in this file are for creators only.
router.use(authorize('creator'));

// @route   GET /followers
// @desc    Get the current creator's followers
// @access  Private (Creator only)
router.get('/followers', followController.getMyFollowers);

// @route   DELETE /followers/:followerId
// @desc    Remove a follower
// @access  Private (Creator only)
router.delete(
  '/followers/:followerId',
  removeFollowerValidator,
  followController.removeFollower
);

module.exports = router;