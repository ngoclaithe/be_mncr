const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const config = require('../config');
const logger = require('../utils/logger');
const User = require('../models/User');

/**
 * Middleware xác thực tùy chọn - Optional Authentication
 * Nếu có token hợp lệ thì set req.user, không có thì vẫn cho phép tiếp tục
 * @param {boolean} requireActive - Có yêu cầu tài khoản phải active không (mặc định: false)
 * @param {boolean} requireEmailVerified - Có yêu cầu email đã verify không (mặc định: false)
 */
const optionalAuth = (requireActive = false, requireEmailVerified = false) => {
  return async (req, res, next) => {
    let token;
    
    try {
      // Lấy token từ header Authorization
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      } 
      // Hoặc lấy token từ cookie
      else if (req.cookies?.token) {
        token = req.cookies.token;
      }

      // Nếu không có token, bỏ qua xác thực
      if (!token) {
        logger.debug('No token provided, continuing without authentication');
        return next();
      }

      // Xác minh token
      const decoded = jwt.verify(token, config.jwt.secret);

      // Lấy thông tin người dùng từ cơ sở dữ liệu
      const user = await User.findByPk(decoded.id, {
        attributes: [
          'id', 'username', 'email', 'firstName', 'lastName', 'role', 
          'isActive', 'isEmailVerified', 'avatar', 'lastLogin', 
          'createdAt', 'updatedAt'
        ]
      });

      if (!user) {
        logger.warn(`User not found for token with ID: ${decoded.id}`);
        // Không throw error, chỉ log warning và tiếp tục
        return next();
      }

      // Kiểm tra tài khoản có bị khóa không (nếu yêu cầu)
      if (requireActive && user.isActive === false) {
        logger.warn(`Inactive user tried to access: ${user.id}`);
        // Không throw error, chỉ log warning và tiếp tục
        return next();
      }

      // Kiểm tra xác thực email (nếu yêu cầu)
      if (requireEmailVerified && !user.isEmailVerified) {
        logger.warn(`Unverified user tried to access: ${user.id}`);
        // Không throw error, chỉ log warning và tiếp tục
        return next();
      }

      // Set user vào request
      req.user = user;
      logger.debug(`User authenticated successfully: ${user.id} - ${user.username}`);
      
      next();
    } catch (error) {
      // Log lỗi nhưng không dừng request
      logger.warn(`Optional auth failed: ${error.message}`);
      
      // Không set req.user và tiếp tục
      next();
    }
  };
};

/**
 * Middleware xác thực linh động - Flexible Authentication
 * Có thể cấu hình nhiều tùy chọn khác nhau
 * @param {Object} options - Cấu hình tùy chọn
 * @param {boolean} options.required - Token có bắt buộc không (mặc định: false)
 * @param {boolean} options.requireActive - Tài khoản phải active (mặc định: true khi required)
 * @param {boolean} options.requireEmailVerified - Email phải verified (mặc định: false)
 * @param {Array<string>} options.allowedRoles - Các role được phép (mặc định: tất cả)
 * @param {boolean} options.skipInactive - Bỏ qua user inactive thay vì throw error (mặc định: false)
 */
const flexibleAuth = (options = {}) => {
  const {
    required = false,
    requireActive = required,
    requireEmailVerified = false,
    allowedRoles = [],
    skipInactive = false
  } = options;

  return async (req, res, next) => {
    let token;
    
    try {
      // Lấy token từ header Authorization
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      } 
      // Hoặc lấy token từ cookie
      else if (req.cookies?.token) {
        token = req.cookies.token;
      }

      // Kiểm tra token bắt buộc
      if (required && !token) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
          success: false,
          message: 'Token xác thực là bắt buộc'
        });
      }

      // Nếu không có token và không bắt buộc
      if (!token) {
        return next();
      }

      // Xác minh token
      const decoded = jwt.verify(token, config.jwt.secret);

      // Lấy thông tin người dùng
      const user = await User.findByPk(decoded.id, {
        attributes: [
          'id', 'username', 'email', 'firstName', 'lastName', 'role', 
          'isActive', 'isEmailVerified', 'avatar', 'lastLogin', 
          'createdAt', 'updatedAt'
        ]
      });

      if (!user) {
        if (required) {
          return res.status(StatusCodes.NOT_FOUND).json({
            success: false,
            message: 'Không tìm thấy người dùng với token này'
          });
        }
        return next();
      }

      // Kiểm tra tài khoản active
      if (requireActive && user.isActive === false) {
        if (skipInactive) {
          return next(); // Bỏ qua user này
        }
        return res.status(StatusCodes.FORBIDDEN).json({
          success: false,
          message: 'Tài khoản đã bị khóa'
        });
      }

      // Kiểm tra email verified
      if (requireEmailVerified && !user.isEmailVerified) {
        return res.status(StatusCodes.FORBIDDEN).json({
          success: false,
          message: 'Vui lòng xác thực email trước khi tiếp tục'
        });
      }

      // Kiểm tra role nếu có yêu cầu
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        return res.status(StatusCodes.FORBIDDEN).json({
          success: false,
          message: `Vai trò ${user.role} không được phép truy cập`
        });
      }

      // Set user vào request
      req.user = user;
      next();

    } catch (error) {
      logger.error(`Flexible auth error: ${error.message}`);
      
      if (error.name === 'JsonWebTokenError') {
        if (required) {
          return res.status(StatusCodes.UNAUTHORIZED).json({
            success: false,
            message: 'Token không hợp lệ'
          });
        }
        return next(); // Không bắt buộc thì bỏ qua
      }
      
      if (error.name === 'TokenExpiredError') {
        if (required) {
          return res.status(StatusCodes.UNAUTHORIZED).json({
            success: false,
            message: 'Token đã hết hạn'
          });
        }
        return next(); // Không bắt buộc thì bỏ qua
      }
      
      if (required) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: 'Lỗi xác thực'
        });
      }
      
      next(); // Không bắt buộc thì bỏ qua lỗi
    }
  };
};

module.exports = {
  optionalAuth,
  flexibleAuth
};