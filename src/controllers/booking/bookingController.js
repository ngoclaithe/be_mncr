const { User, Creator, Booking, Wallet, Transaction, Notification } = require('../../models');
const { StatusCodes } = require('http-status-codes');
const { validationResult } = require('express-validator');
const mqttService = require('../../services/mqtt/mqtt');
const logger = require('../../utils/logger'); 

const generateUniqueMqttTopic = () => {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `booking/${timestamp}_${randomStr}`;
};

const createNotification = async (userId, notificationData) => {
  try {
    await Notification.create({
      userId,
      type: 'booking',
      ...notificationData
    });
    
    const mqttPayload = {
      ...notificationData,
      type: 'booking',
      timestamp: new Date().toISOString()
    };
    await mqttService.publish(`notifications/${userId}`, JSON.stringify(mqttPayload));
  } catch (error) {
    logger.error('Error creating notification:', error);
  }
};

// User tạo booking
const createBooking = async (req, res) => {
  try {
    // Kiểm tra validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { creatorId, type, duration, scheduledTime, notes } = req.body;

    // Tìm creator
    const creator = await Creator.findByPk(creatorId);
    if (!creator) {
      return res.status(StatusCodes.OK).json({
        success: false,
        message: 'Creator không tồn tại'
      });
    }

    // Tìm user wallet
    const userWallet = await Wallet.findOne({ where: { userId } });
    if (!userWallet) {
      return res.status(StatusCodes.OK).json({
        success: false,
        message: 'Wallet không tồn tại'
      });
    }

    // Tính giá dựa trên type
    let pricePerMinute, totalPrice;

    if (['byshot', 'private_chat', 'cam2cam', 'private_show'].includes(type)) {
      if (!creator.bookingPrice) {
        return res.status(StatusCodes.OK).json({
          success: false,
          message: 'Creator chưa thiết lập giá booking'
        });
      }
      pricePerMinute = creator.bookingPrice;
      totalPrice = pricePerMinute * duration;
    } else if (type === 'byhour') {
      if (!creator.hourlyRate) {
        return res.status(StatusCodes.OK).json({
          success: false,
          message: 'Creator chưa thiết lập giá theo giờ'
        });
      }
      pricePerMinute = creator.hourlyRate / 60;
      totalPrice = creator.hourlyRate * (duration / 60);
    } else {
      return res.status(StatusCodes.OK).json({
        success: false,
        message: 'Loại booking không hợp lệ'
      });
    }

    // Kiểm tra số dư token
    if (userWallet.token < totalPrice) {
      return res.status(StatusCodes.OK).json({
        success: false,
        message: 'Số token không đủ để thực hiện booking'
      });
    }

    // Kiểm tra creator có thể nhận booking không
    if (!creator.isAvailableForBooking) {
      return res.status(StatusCodes.OK).json({
        success: false,
        message: 'Creator hiện không thể nhận booking'
      });
    }

    if (creator.currentBookingsCount >= creator.maxConcurrentBookings) {
      return res.status(StatusCodes.OK).json({
        success: false,
        message: 'Creator đã đạt giới hạn số booking đồng thời'
      });
    }

    // Trừ token từ wallet user
    await userWallet.update({
      token: userWallet.token - totalPrice
    });

    // Tạo booking
    const booking = await Booking.create({
      userId,
      creatorId,
      type,
      duration,
      scheduledTime,
      pricePerMinute,
      totalPrice,
      status: 'pending',
      paymentStatus: 'paid',
      notes
    });

    // Tạo thông báo cho creator
    await createNotification(creator.userId, {
      title: 'Booking mới',
      type: 'booking',
      message: 'Bạn có booking mới',
      bookingId: booking.id
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Booking được tạo thành công',
      data: booking
    });

  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Lỗi server khi tạo booking'
    });
  }
};

// Creator đồng ý booking
const acceptBooking = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array()
      });
    }

    const { bookingId } = req.params;
    const creatorUserId = req.user.id;

    // Tìm creator
    const creator = await Creator.findOne({ where: { userId: creatorUserId } });
    if (!creator) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Bạn không phải là creator'
      });
    }

    // Tìm booking
    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Booking không tồn tại'
      });
    }

    // Kiểm tra booking thuộc về creator này
    if (booking.creatorId !== creator.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Bạn không có quyền thao tác với booking này'
      });
    }

    // Kiểm tra status
    if (booking.status !== 'pending') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Booking không ở trạng thái pending'
      });
    }

    // Cập nhật booking và currentBookingsCount
    await booking.update({
      status: 'confirmed',
      startTime: booking.scheduledTime  // Sử dụng scheduledTime thay vì thời gian hiện tại
    });

    await creator.update({
      currentBookingsCount: creator.currentBookingsCount + 1
    });

    // Tạo thông báo cho user
    await createNotification(booking.userId, {
      title: 'Booking được chấp nhận',
      type: 'booking',
      message: 'Booking của bạn đã được chấp nhận',
      bookingId: booking.id
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Đã chấp nhận booking thành công',
      data: booking
    });

  } catch (error) {
    console.error('Error accepting booking:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Lỗi server khi chấp nhận booking'
    });
  }
};

// Creator từ chối booking
const rejectBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { cancellationReason } = req.body;
    const creatorUserId = req.user.id;

    // Tìm creator
    const creator = await Creator.findOne({ where: { userId: creatorUserId } });
    if (!creator) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Bạn không phải là creator'
      });
    }

    // Tìm booking
    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Booking không tồn tại'
      });
    }

    // Kiểm tra booking thuộc về creator này
    if (booking.creatorId !== creator.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Bạn không có quyền thao tác với booking này'
      });
    }

    // Kiểm tra status
    if (booking.status !== 'pending') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Booking không ở trạng thái pending'
      });
    }

    // Hoàn token cho user
    const userWallet = await Wallet.findOne({ where: { userId: booking.userId } });
    if (userWallet) {
      await userWallet.update({
        token: userWallet.token + booking.totalPrice
      });
    }

    // Cập nhật booking
    await booking.update({
      status: 'cancelled',
      paymentStatus: 'refunded',
      cancellationReason,
      cancelledBy: creatorUserId
    });

    // Tạo thông báo cho user
    await createNotification(booking.userId, {
      title: 'Booking bị từ chối',
      type: 'booking',
      message: 'Booking của bạn đã bị từ chối',
      bookingId: booking.id
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Đã từ chối booking và hoàn tiền thành công'
    });

  } catch (error) {
    console.error('Error rejecting booking:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Lỗi server khi từ chối booking'
    });
  }
};

// Creator hoàn thành booking
const completeBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const creatorUserId = req.user.id;

    // Tìm creator
    const creator = await Creator.findOne({ where: { userId: creatorUserId } });
    if (!creator) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Bạn không phải là creator'
      });
    }

    // Tìm booking
    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Booking không tồn tại'
      });
    }

    // Kiểm tra booking thuộc về creator này
    if (booking.creatorId !== creator.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Bạn không có quyền thao tác với booking này'
      });
    }

    // Kiểm tra status
    if (!['confirmed', 'in_progress'].includes(booking.status)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Booking không ở trạng thái có thể hoàn thành'
      });
    }

    // Tìm creator wallet
    const creatorWallet = await Wallet.findOne({ where: { userId: creatorUserId } });
    if (!creatorWallet) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Creator wallet không tồn tại'
      });
    }

    // Tính commission (giả sử 20% cho platform, 80% cho creator)
    const commissionRate = 20; // 20%
    const commissionAmount = (booking.totalPrice * commissionRate) / 100;
    const creatorEarning = booking.totalPrice - commissionAmount;

    // Kiểm tra thời gian hoàn thành có hợp lý không
    const currentTime = new Date();
    const scheduledStartTime = new Date(booking.scheduledTime);
    const expectedMinEndTime = new Date(scheduledStartTime.getTime() + (booking.duration * 60 * 1000) + (5 * 60 * 1000)); // scheduledTime + duration + 5 phút
    
    if (currentTime < expectedMinEndTime) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Booking chỉ có thể hoàn thành sau ${expectedMinEndTime.toLocaleString('vi-VN')}`
      });
    }

    // Chuyển đổi sang số để tránh lỗi cộng dồn
    const currentTokens = parseFloat(creatorWallet.token) || 0;
    const currentEarnings = parseFloat(creator.totalEarnings) || 0;
    const earningAmount = parseFloat(creatorEarning);

    // Cập nhật số token creator
    await creatorWallet.update({
      token: Math.round((currentTokens + earningAmount) * 100) / 100  // Làm tròn 2 chữ số thập phân
    });

    // Cập nhật creator earnings
    await creator.update({
      totalEarnings: Math.round((currentEarnings + earningAmount) * 100) / 100,  // Làm tròn 2 chữ số thập phân
      currentBookingsCount: Math.max(0, creator.currentBookingsCount - 1)
    });

    // Cập nhật booking
    await booking.update({
      status: 'completed',
      endTime: new Date()
    });

    // Tạo transaction record
    await Transaction.create({
      fromUserId: booking.userId,
      toUserId: creatorUserId,
      type: 'booking',
      amount: booking.totalPrice,
      status: 'completed',
      description: `Thanh toán cho booking ${booking.type}`,
      bookingId: booking.id,
      commissionRate,
      commissionAmount
    });

    // Tạo thông báo cho user
    await createNotification(booking.userId, {
      title: 'Booking hoàn thành',
      type: 'booking',
      message: 'Booking của bạn đã hoàn thành',
      bookingId: booking.id
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Booking đã hoàn thành thành công',
      data: {
        booking,
        creatorEarning,
        commissionAmount
      }
    });

  } catch (error) {
    console.error('Error completing booking:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Lỗi server khi hoàn thành booking'
    });
  }
};

// User hủy booking
const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { cancellationReason } = req.body;
    const userId = req.user.id;

    // Tìm booking
    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Booking không tồn tại'
      });
    }

    // Kiểm tra booking thuộc về user này
    if (booking.userId !== userId) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Bạn không có quyền thao tác với booking này'
      });
    }

    // Chỉ có thể hủy khi booking ở trạng thái pending
    if (booking.status !== 'pending') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Không thể hủy booking đã được xác nhận'
      });
    }

    // Hoàn token cho user
    const userWallet = await Wallet.findOne({ where: { userId } });
    if (userWallet) {
      await userWallet.update({
        token: userWallet.token + booking.totalPrice
      });
    }

    // Cập nhật booking
    await booking.update({
      status: 'cancelled',
      paymentStatus: 'refunded',
      cancellationReason,
      cancelledBy: userId
    });

    // Tạo thông báo cho creator
    const creator = await Creator.findByPk(booking.creatorId);
    if (creator) {
      await createNotification(creator.userId, {
        title: 'Booking bị hủy',
        type: 'booking',
        message: 'Một booking đã bị hủy',
        bookingId: booking.id
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Đã hủy booking và hoàn tiền thành công'
    });

  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Lỗi server khi hủy booking'
    });
  }
};

// Lấy danh sách booking của user
const getUserBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('User ID:', userId);
    const { status, page = 1, limit = 10 } = req.query;

    const whereClause = { userId };
    if (status) {
      whereClause.status = status;
    }

    const offset = (page - 1) * limit;

    const bookings = await Booking.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Creator,
          attributes: ['id', 'stageName', 'rating'],
          as: 'creator',
          include: [
            {
              model: User,
              attributes: ['id', 'avatar'],
              as: 'user'
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Format lại data để hiển thị avatar từ User table
    const formattedBookings = bookings.rows.map(booking => {
      const bookingData = booking.toJSON();
      if (bookingData.creator && bookingData.creator.user) {
        bookingData.creator.avatar = bookingData.creator.user.avatar;
        // Xóa nested user object để response clean hơn
        delete bookingData.creator.user;
      }
      return bookingData;
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: formattedBookings,
      pagination: {
        total: bookings.count,
        page: parseInt(page),
        pages: Math.ceil(bookings.count / limit)
      }
    });

  } catch (error) {
    console.error('Error getting user bookings:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách booking'
    });
  }
};

// Lấy danh sách booking của creator
const getCreatorBookings = async (req, res) => {
  try {
    const creatorUserId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    // Tìm creator
    const creator = await Creator.findOne({ where: { userId: creatorUserId } });
    if (!creator) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Bạn không phải là creator'
      });
    }

    const whereClause = { creatorId: creator.id };
    if (status) {
      whereClause.status = status;
    }

    const offset = (page - 1) * limit;

    const bookings = await Booking.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          attributes: ['id', 'username', 'firstName', 'lastName', 'avatar'],
          as: 'client'
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: bookings.rows,
      pagination: {
        total: bookings.count,
        page: parseInt(page),
        pages: Math.ceil(bookings.count / limit)
      }
    });

  } catch (error) {
    console.error('Error getting creator bookings:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách booking'
    });
  }
};

module.exports = {
  createBooking,
  acceptBooking,
  rejectBooking,
  completeBooking,
  cancelBooking,
  getUserBookings,
  getCreatorBookings
};