const express = require('express');
const router = express.Router();
const followController = require('../../controllers/user/followController');
const { protect } = require('../../middleware/auth');
const { 
    followValidator
} = require('../../middleware/validation/userFollowCreatorValidation');

// @route   POST api/v1/user-follows
// @desc    Follow a user
// @access  Private
router.post('/', protect, followValidator, followController.follow);

// @route   DELETE api/v1/user-follows/:userId
// @desc    Unfollow a user
// @access  Private
router.delete('/:userId', protect, followController.unfollow);

// @route   GET api/v1/user-follows/:userId/following
// @desc    Get list of users a user is following
// @access  Public
router.get('/:userId/following', followController.getFollowingList);

// @route   GET api/v1/user-follows/:userId/followers
// @desc    Get list of followers for a user
// @access  Public
router.get('/:userId/followers', followController.getFollowersList);
// @route   GET api/v1/user-follows/:userId/public-info
// @desc    Get public information for a user
// @access  Public
router.get('/:userId/public-info', followController.getPublicInfoUser);

module.exports = router;
