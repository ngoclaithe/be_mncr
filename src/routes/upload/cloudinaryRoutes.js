const express = require('express');
const cloudinaryController = require('../../controllers/upload/cloudinaryController');

const router = express.Router();

router.post('/signature', cloudinaryController.generateSignature);

router.post('/optimize-urls', cloudinaryController.generateOptimizedUrls);

module.exports = router;