const express = require('express');
const router = express.Router();
const subController = require('../../controllers/package/creatorPackageSubscriptionController');
const { protect, authorize } = require('../../middleware/auth');
const { subscribeValidator } = require('../../middleware/validation/creatorPackageSubscriptionValidation');

router.route('/')
  .get(
    protect,
    authorize('admin', 'creator'),
    subController.getSubscriptions
  )
  .post(
    protect,
    authorize('creator'),
    subscribeValidator,
    subController.subscribeToPackage
  );

// Creator-specific routes for their own current subscription
router.get(
  '/me',
  protect,
  authorize('creator'),
  subController.getMySubscription
);

router.patch(
  '/me/cancel',
  protect,
  authorize('creator'),
  subController.cancelSubscription
);

module.exports = router;