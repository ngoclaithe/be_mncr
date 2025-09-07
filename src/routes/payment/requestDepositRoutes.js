const express = require('express');
const router = express.Router();
const requestDepositController = require('../../controllers/payment/requestDepositController');
const { protect, authorize } = require('../../middleware/auth');
const {
  createRequestDepositValidator,
  updateRequestDepositValidator,
} = require('../../middleware/validation/requestDepositValidation');

// All routes require authentication
router.use(protect);

// Create new deposit request (Users) and get all requests (Admin gets all, Users get their own)
router.route('/')
  .post(createRequestDepositValidator, requestDepositController.createRequest)
  .get(requestDepositController.getRequests); 

// Get, update status, or delete specific deposit request by ID
router.route('/:id')
  .get(requestDepositController.getRequestById) 
  .put(
    authorize('admin'),
    updateRequestDepositValidator,
    requestDepositController.updateRequestStatus
  )
  .delete(authorize('admin'), requestDepositController.deleteRequest);

module.exports = router;