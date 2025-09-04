const express = require('express');
const router = express.Router();
const storyController = require('../../controllers/social/storyController');
const { protect, checkOwnership } = require('../../middleware/auth');
const { Story } = require('../../models');
const { createStoryValidator, storyIdValidator } = require('../../middleware/validation/storyValidation');

const multer = require('multer');
const upload = multer({ dest: 'uploads/stories/' });

router.route('/')
  .get(protect, storyController.getStoryFeed)
  .post(
    protect,
    upload.single('media'), // Middleware xử lý upload 1 file với field name là 'media'
    createStoryValidator,
    storyController.createStory
  );

router.route('/:storyId')
  .delete(
    protect,
    storyIdValidator,
    checkOwnership(Story, 'storyId', 'userId'),
    storyController.deleteStory
  );

module.exports = router;