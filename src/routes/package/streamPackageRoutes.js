const express = require('express');
const router = express.Router();
const streamPackageController = require('../../controllers/package/streamPackageController');
const { protect, authorize } = require('../../middleware/auth');
const { streamPackageValidator } = require('../../middleware/validation/streamPackageValidation');

// Routes for viewing packages (accessible by Admin & Creator)
router.get('/',
  protect,
  authorize('admin', 'creator'),
  streamPackageController.getAll.bind(streamPackageController)
);

router.get('/:id',
  protect,
  authorize('admin', 'creator'),
  streamPackageController.getById.bind(streamPackageController)
);

// Routes for managing packages (accessible by Admin only)
router.post('/',
  protect,
  authorize('admin'),
  streamPackageValidator,
  streamPackageController.create.bind(streamPackageController)
);

router.put('/:id',
  protect,
  authorize('admin'),
  streamPackageValidator,
  streamPackageController.update.bind(streamPackageController)
);

router.delete('/:id',
  protect,
  authorize('admin'),
  streamPackageController.delete.bind(streamPackageController)
);

module.exports = router;