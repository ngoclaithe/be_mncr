const express = require('express');
const router = express.Router();
const streamController = require('../../controllers/streaming/streamController');
const { protect, authorize } = require('../../middleware/auth');
const {
  createStreamValidator, 
  streamIdValidator, 
  streamKeyValidator,
  getLiveStreamsValidator
} = require('../../middleware/validation/streamValidation');

// ===================================
// Stream Management Routes - Cần auth
// ===================================

// Tạo stream session mới (chỉ trả về streamKey và socketEndpoint)
router.post('/start',
  protect,
  authorize('creator'),
  createStreamValidator,
  streamController.startStream
);

// Kết thúc stream
router.post('/:streamKey/stop',
  protect,
  authorize('creator'),
  streamKeyValidator,
  streamController.stopStream
);

// Lấy thông tin stream (cho creator hoặc viewer)
router.get('/:streamId/info',
  streamIdValidator,
  streamController.getStreamInfo
);

// ===================================
// Stream Interaction Routes
// ===================================

// Update viewer count (được gọi từ client-side hoặc streaming service)
router.post('/:streamKey/viewers',
  streamKeyValidator,
  streamController.updateViewerCount
);

// Update donation amount
router.post('/:streamKey/donations',
  streamKeyValidator,
  streamController.updateDonations
);

// ===================================
// Public Routes - Không cần auth
// ===================================

// Lấy danh sách streams đang live (cho homepage)
router.get('/live',
  getLiveStreamsValidator,
  streamController.getLiveStreams
);
// Validate stream connection (được gọi từ socket middleware)
router.post('/validate/:streamKey',
  async (req, res) => {
    try {
      const { streamKey } = req.params;
      const result = await streamController.validateStreamConnection(streamKey);
      
      if (result.valid) {
        res.json({ 
          success: true, 
          message: 'Valid stream key',
          data: result.stream 
        });
      } else {
        res.status(400).json({ 
          success: false, 
          message: result.message 
        });
      }
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      });
    }
  }
);

// ===================================
// Internal Routes - Được gọi từ socket handlers
// ===================================

// Stream start handler (được gọi từ socket khi connection thành công)
router.post('/internal/start/:streamKey',
  async (req, res) => {
    try {
      const { streamKey } = req.params;
      const success = await streamController.handleStreamStart(streamKey);
      
      if (success) {
        res.json({ success: true, message: 'Stream started successfully' });
      } else {
        res.status(400).json({ success: false, message: 'Failed to start stream' });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

// Stream end handler (được gọi từ socket khi disconnect)
router.post('/internal/end/:streamKey',
  async (req, res) => {
    try {
      const { streamKey } = req.params;
      const success = await streamController.handleStreamEnd(streamKey);
      
      if (success) {
        res.json({ success: true, message: 'Stream ended successfully' });
      } else {
        res.status(400).json({ success: false, message: 'Failed to end stream' });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

// ===================================
// Stats & Monitoring Routes
// ===================================

// Stream statistics (cho admin dashboard)
router.get('/stats',
  protect,
  authorize('admin'),
  async (req, res) => {
    try {
      // Có thể implement later
      res.json({ 
        success: true, 
        data: {
          totalStreams: 0,
          liveStreams: 0,
          totalViewers: 0
        }, 
        message: 'Stats endpoint - to be implemented' 
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

// Health check cho streaming service
router.get('/health',
  (req, res) => {
    res.json({ 
      success: true, 
      message: 'Streaming service is healthy',
      timestamp: new Date().toISOString()
    });
  }
);

module.exports = router;