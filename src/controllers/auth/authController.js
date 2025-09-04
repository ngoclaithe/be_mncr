const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, Creator, Admin, Wallet, sequelize } = require('../../models');
const { getRedisClient } = require('../../config/redis');
const ApiError = require('../../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const logger = require('../../utils/logger');
const config = require('../../config');
const { Op } = require('sequelize');
const { validationResult } = require('express-validator');

/**
 * Generates a JWT for a given user.
 * @param {object} user - The user object from Sequelize.
 * @returns {string} The generated JWT.
 * @throws {ApiError} If JWT secret is not configured.
 */
const generateToken = (user) => {
  const payload = {
    id: user.id,
    userId: user.id, // Included for consistency with original code
    email: user.email,
    role: user.role,
    userName: user.username
  };

  const secret = config.jwt?.secret || process.env.JWT_SECRET;
  if (!secret) {
    logger.error('JWT_SECRET is not configured. The application cannot sign tokens.');
    throw new ApiError('Lỗi cấu hình máy chủ, không thể tạo token.', StatusCodes.INTERNAL_SERVER_ERROR);
  }
  return jwt.sign(payload, secret, { expiresIn: config.jwt?.expire || '7d' });
};

const validatePassword = (password) => {
  const errors = [];
  if (!password) {
    errors.push('Mật khẩu là bắt buộc');
  } else {
    if (password.length < 8) {
      errors.push('Mật khẩu phải có ít nhất 8 ký tự');
    }
    if (password.length > 128) {
      errors.push('Mật khẩu không được vượt quá 128 ký tự');
    }
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một chữ cái thường');
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một chữ cái hoa');
    }
    if (!/(?=.*\d)/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một chữ số');
    }
    if (!/(?=.*[!@#$%^&*])/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một ký tự đặc biệt (!@#$%^&*)');
    }
  }
  return errors;
};

const validateEmail = (email) => {
  const errors = [];
  if (!email) {
    errors.push('Email là bắt buộc');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Email không hợp lệ');
    }
  }
  return errors;
};

const validateUsername = (username) => {
  const errors = [];
  if (!username) {
    errors.push('Username là bắt buộc');
  } else {
    if (username.trim().length < 3) {
      errors.push('Username phải có ít nhất 3 ký tự');
    }
    if (username.trim().length > 30) {
      errors.push('Username không được vượt quá 30 ký tự');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.push('Username chỉ được chứa chữ cái, số và dấu gạch dưới');
    }
  }
  return errors;
};

const validateName = (name) => {
  const errors = [];
  if (!name) {
    errors.push('Tên là bắt buộc');
  } else {
    if (name.trim().length < 2) {
      errors.push('Tên phải có ít nhất 2 ký tự');
    }
    if (name.trim().length > 50) {
      errors.push('Tên không được vượt quá 50 ký tự');
    }
  }
  return errors;
};

class AuthController {
  // Đăng ký user mới
  async register(req, res, next) {
    try {
      const {
        email,
        username,
        password,
        firstName,
        lastName,
        phoneNumber,
        dateOfBirth,
        gender,
        country,
        city,
        timezone,
        language = 'vi',
        referralCode
      } = req.body;

      const validationErrors = [];

      // Validate required fields
      validationErrors.push(...validateEmail(email));
      validationErrors.push(...validateUsername(username));
      validationErrors.push(...validatePassword(password));

      if (firstName) {
        validationErrors.push(...validateName(firstName));
      }
      if (lastName) {
        validationErrors.push(...validateName(lastName));
      }

      // Check existing user
      if (email || username) {
        const existingUser = await User.findOne({
          where: {
            [Op.or]: [
              email ? { email: email.toLowerCase() } : null,
              username ? { username: username.toLowerCase() } : null
            ].filter(Boolean)
          }
        });

        if (existingUser) {
          if (existingUser.email === email?.toLowerCase()) {
            validationErrors.push('Email này đã được sử dụng');
          }
          if (existingUser.username === username?.toLowerCase()) {
            validationErrors.push('Username này đã được sử dụng');
          }
        }
      }

      if (validationErrors.length > 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Dữ liệu đầu vào không hợp lệ',
          errors: validationErrors
        });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Generate affiliate code
      const affiliateCode = crypto.randomBytes(8).toString('hex').toUpperCase();

      // Handle referral
      let referredBy = null;
      if (referralCode) {
        const referrer = await User.findOne({
          where: { affiliateCode: referralCode }
        });
        if (referrer) {
          referredBy = referrer.id;
        }
      }

      // Create user
      const user = await User.create({
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        password: hashedPassword,
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
        phoneNumber,
        dateOfBirth,
        gender,
        country,
        city,
        timezone,
        language,
        affiliateCode,
        referredBy,
        role: 'user',
        registrationDate: new Date()
      });

      // Generate JWT token
      const token = generateToken(user);

      const wallet = await Wallet.create({ userId: user.id });

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: 'Đăng ký thành công',
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          avatar: user.avatar,
          affiliateCode: user.affiliateCode
        }
      });

    } catch (error) {
      logger.error(`Register error: ${error.message}`);
      next(error);
    }
  }

  // Đăng nhập
  async login(req, res, next) {
    try {
      const { loginField, password } = req.body;

      const validationErrors = [];

      if (!loginField) {
        validationErrors.push('Email/Username là bắt buộc');
      }
      if (!password) {
        validationErrors.push('Mật khẩu là bắt buộc');
      }

      if (validationErrors.length > 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Thông tin đăng nhập không đầy đủ',
          errors: validationErrors
        });
      }

      // Find user by email or username
      const user = await User.findOne({
        where: {
          [Op.or]: [
            { email: loginField.toLowerCase() },
            { username: loginField.toLowerCase() }
          ]
        },
        include: [{
          model: Creator,
          as: 'creatorProfile',
          required: false
        }]
      });

      if (!user) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
          success: false,
          message: 'Thông tin đăng nhập không chính xác',
          errors: ['Email/Username hoặc mật khẩu không đúng']
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
          success: false,
          message: 'Thông tin đăng nhập không chính xác',
          errors: ['Email/Username hoặc mật khẩu không đúng']
        });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(StatusCodes.FORBIDDEN).json({
          success: false,
          message: 'Tài khoản bị khóa',
          errors: ['Tài khoản của bạn đã bị khóa, vui lòng liên hệ quản trị viên']
        });
      }

      // Update last login and online status
      await user.update({
        lastLogin: new Date(),
        isOnline: true
      });

      // Generate JWT token
      const token = generateToken(user);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Đăng nhập thành công',
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          avatar: user.avatar,
          creatorProfile: user.creatorProfile
        }
      });

    } catch (error) {
      logger.error(`Login error: ${error.message}`);
      next(error);
    }
  }

  // Đăng xuất
  async logout(req, res, next) {
    try {
      // Blacklist token in Redis if enabled and available
      if (config.redis.enabled) {
        const redisClient = getRedisClient();
        const token = req.headers.authorization?.split(' ')[1];

        if (token && redisClient) {
          const secret = config.jwt?.secret || process.env.JWT_SECRET;
          if (secret) {
            const decoded = jwt.verify(token, secret);
            const expiration = Math.floor(decoded.exp - Date.now() / 1000);
            if (expiration > 0) {
              await redisClient.set(`bl_${decoded.id}`, token, { EX: expiration });
            }
          }
        }
      }

      // Update user online status
      if (req.user?.id) {
        await User.update(
          { isOnline: false },
          { where: { id: req.user.id } }
        );
      }

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Đăng xuất thành công',
        data: {}
      });

    } catch (error) {
      logger.error(`Logout error: ${error.message}`);
      next(error);
    }
  }

  // Lấy thông tin người dùng hiện tại
  async getMe(req, res, next) {
    try {
      const user = await User.findOne({
        where: {
          id: req.user.id,
          isActive: true
        },
        include: [{
          model: Creator,
          as: 'creatorProfile',
          required: false
        }],
        attributes: { exclude: ['password'] }
      });

      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: 'Không tìm thấy thông tin người dùng',
          errors: ['Không tìm thấy người dùng hoặc tài khoản đã bị khóa']
        });
      }

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Lấy thông tin người dùng thành công',
        data: user
      });

    } catch (error) {
      logger.error(`Get me error: ${error.message}`);
      next(error);
    }
  }

  // Cập nhật thông tin người dùng
  async updateDetails(req, res, next) {
    try {
      const {
        firstName,
        lastName,
        phoneNumber,
        dateOfBirth,
        gender,
        country,
        city,
        timezone,
        language,
        avatar
      } = req.body;

      const validationErrors = [];

      if (firstName !== undefined) {
        validationErrors.push(...validateName(firstName));
      }

      if (lastName !== undefined) {
        validationErrors.push(...validateName(lastName));
      }

      if (validationErrors.length > 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Dữ liệu cập nhật không hợp lệ',
          errors: validationErrors
        });
      }

      const fieldsToUpdate = {};
      if (firstName !== undefined) fieldsToUpdate.firstName = firstName.trim();
      if (lastName !== undefined) fieldsToUpdate.lastName = lastName.trim();
      if (phoneNumber !== undefined) fieldsToUpdate.phoneNumber = phoneNumber;
      if (dateOfBirth !== undefined) fieldsToUpdate.dateOfBirth = dateOfBirth;
      if (gender !== undefined) fieldsToUpdate.gender = gender;
      if (country !== undefined) fieldsToUpdate.country = country;
      if (city !== undefined) fieldsToUpdate.city = city;
      if (timezone !== undefined) fieldsToUpdate.timezone = timezone;
      if (language !== undefined) fieldsToUpdate.language = language;
      if (avatar !== undefined) fieldsToUpdate.avatar = avatar;

      await User.update(fieldsToUpdate, {
        where: { id: req.user.id }
      });

      const user = await User.findOne({
        where: { id: req.user.id },
        attributes: { exclude: ['password'] }
      });

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Cập nhật thông tin thành công',
        data: user
      });

    } catch (error) {
      logger.error(`Update details error: ${error.message}`);
      next(error);
    }
  }

  // Đổi mật khẩu
  async updatePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;

      const validationErrors = [];

      if (!currentPassword) {
        validationErrors.push('Mật khẩu hiện tại là bắt buộc');
      }

      validationErrors.push(...validatePassword(newPassword));

      if (validationErrors.length > 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Dữ liệu thay đổi mật khẩu không hợp lệ',
          errors: validationErrors
        });
      }

      const user = await User.findOne({
        where: { id: req.user.id }
      });

      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: 'Không tìm thấy người dùng',
          errors: ['Không tìm thấy thông tin người dùng']
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
          success: false,
          message: 'Mật khẩu hiện tại không đúng',
          errors: ['Mật khẩu hiện tại không chính xác']
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      await user.update({ password: hashedNewPassword });

      const token = generateToken(user);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Thay đổi mật khẩu thành công',
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          avatar: user.avatar
        }
      });

    } catch (error) {
      logger.error(`Update password error: ${error.message}`);
      next(error);
    }
  }

  // Quên mật khẩu
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      const validationErrors = validateEmail(email);

      if (validationErrors.length > 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Email không hợp lệ',
          errors: validationErrors
        });
      }

      const user = await User.findOne({
        where: { email: email.toLowerCase() }
      });

      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: 'Không tìm thấy người dùng',
          errors: ['Không tìm thấy người dùng với email này']
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(20).toString('hex');
      const resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

      // Set token expiration (10 minutes)
      const resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000);

      await user.update({
        resetPasswordToken,
        resetPasswordExpire
      });

      const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/resetpassword/${resetToken}`;

      console.log(`Reset Password URL: ${resetUrl}`);
      logger.info(`Password reset requested for user: ${user.email}`);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Email đặt lại mật khẩu đã được gửi thành công',
        data: 'Vui lòng kiểm tra email để đặt lại mật khẩu'
      });

    } catch (error) {
      logger.error(`Forgot password error: ${error.message}`);
      next(error);
    }
  }

  // Reset mật khẩu
  async resetPassword(req, res, next) {
    try {
      const { password } = req.body;

      const validationErrors = validatePassword(password);

      if (validationErrors.length > 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Mật khẩu mới không hợp lệ',
          errors: validationErrors
        });
      }

      const resetPasswordToken = crypto
        .createHash('sha256')
        .update(req.params.resettoken)
        .digest('hex');

      const user = await User.findOne({
        where: {
          resetPasswordToken,
          resetPasswordExpire: { [Op.gt]: Date.now() }
        }
      });

      if (!user) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Token không hợp lệ',
          errors: ['Token không hợp lệ hoặc đã hết hạn']
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      await user.update({
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpire: null
      });

      const token = generateToken(user);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Đặt lại mật khẩu thành công',
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          avatar: user.avatar
        }
      });

    } catch (error) {
      logger.error(`Reset password error: ${error.message}`);
      next(error);
    }
  }

  // Đăng ký trở thành creator
  async registerCreator(req, res, next) {
    try {
      const userId = req.user.id;
      const {
        stageName,
        bio,
        tags = [],
        hourlyRate,
        minBookingDuration,
        specialties = [],
        languages = [],
        bodyType,
        height,
        weight,
        eyeColor,
        hairColor,
        bookingPrice,
        subscriptionPrice,
        availabilitySchedule = {}
      } = req.body;

      const validationErrors = [];

      if (!stageName) {
        validationErrors.push('Stage name là bắt buộc');
      }

      if (validationErrors.length > 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Dữ liệu đầu vào không hợp lệ',
          errors: validationErrors
        });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: 'Không tìm thấy người dùng',
          errors: ['Không tìm thấy thông tin người dùng']
        });
      }

      const existingCreator = await Creator.findOne({ where: { userId } });
      if (existingCreator) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Người dùng đã có creator profile',
          errors: ['Bạn đã đăng ký làm creator rồi']
        });
      }

      const creator = await Creator.create({
        userId,
        stageName,
        bio,
        tags,
        hourlyRate,
        minBookingDuration,
        specialties,
        languages,
        bodyType,
        height,
        weight,
        eyeColor,
        hairColor,
        bookingPrice,
        subscriptionPrice,
        availabilitySchedule
      });

      // Update user role to creator
      await user.update({ role: 'creator' });

      // Get updated user with creator profile
      const updatedUser = await User.findOne({
        where: { id: userId },
        include: [{
          model: Creator,
          as: 'creatorProfile'
        }],
        attributes: { exclude: ['password'] }
      });

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: 'Đăng ký creator thành công',
        data: updatedUser
      });

    } catch (error) {
      logger.error(`Register creator error: ${error.message}`);
      next(error);
    }
  }

  // Cập nhật creator profile
  async updateCreatorProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const updateFields = req.body;

      const creator = await Creator.findOne({ where: { userId } });
      if (!creator) {
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: 'Không tìm thấy creator profile',
          errors: ['Bạn chưa đăng ký làm creator']
        });
      }

      const updatedCreator = await creator.update(updateFields);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Cập nhật creator profile thành công',
        data: updatedCreator
      });

    } catch (error) {
      logger.error(`Update creator profile error: ${error.message}`);
      next(error);
    }
  }
  // Thêm method này vào class AuthController
  async getCreatorProfile(req, res, next) {
    try {
      const userId = req.user.id;

      const creator = await Creator.findOne({
        where: { userId },
        include: [{
          model: User,
          as: 'user',
          attributes: { exclude: ['password'] }
        }]
      });

      if (!creator) {
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: 'Không tìm thấy creator profile',
          errors: ['Bạn chưa đăng ký làm creator']
        });
      }

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Lấy thông tin creator profile thành công',
        data: creator
      });

    } catch (error) {
      logger.error(`Get creator profile error: ${error.message}`);
      next(error);
    }
  }
  async getAllUsers(req, res, next) {
    try {
      const { page = 1, limit = 20, role, search } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (role) whereClause.role = role;
      if (search) {
        whereClause[Op.or] = [
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
          { username: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const users = await User.findAndCountAll({
        where: whereClause,
        include: [{
          model: Creator,
          as: 'creatorProfile',
          required: false
        }],
        attributes: { exclude: ['password'] },
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          users: users.rows,
          totalUsers: users.count,
          currentPage: parseInt(page),
          totalPages: Math.ceil(users.count / limit)
        }
      });
    } catch (error) {
      logger.error(`Get all users error: ${error.message}`);
      next(error);
    }
  }

  // Kích hoạt/vô hiệu hóa tài khoản user
  async toggleUserStatus(req, res, next) {
    try {
      const { User } = require('../../models');
      const user = await User.findByPk(req.params.id);

      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: 'Không tìm thấy user'
        });
      }

      await user.update({ isActive: !user.isActive });

      res.json({
        success: true,
        message: `Đã ${user.isActive ? 'kích hoạt' : 'vô hiệu hóa'} tài khoản thành công`,
        data: { isActive: user.isActive }
      });
    } catch (error) {
      logger.error(`Toggle user status error: ${error.message}`);
      next(error);
    }
  }

  // Kiểm tra username có tồn tại không
  async checkUsername(req, res, next) {
    try {
      const { User } = require('../../models');
      const { username } = req.params;

      const existingUser = await User.findOne({
        where: { username: username.toLowerCase() }
      });

      res.json({
        success: true,
        data: {
          available: !existingUser,
          message: existingUser ? 'Username đã được sử dụng' : 'Username có thể sử dụng'
        }
      });
    } catch (error) {
      logger.error(`Check username error: ${error.message}`);
      next(error);
    }
  }

  // Kiểm tra email có tồn tại không
  async checkEmail(req, res, next) {
    try {
      const { User } = require('../../models');
      const { email } = req.params;

      const existingUser = await User.findOne({
        where: { email: email.toLowerCase() }
      });

      res.json({
        success: true,
        data: {
          available: !existingUser,
          message: existingUser ? 'Email đã được sử dụng' : 'Email có thể sử dụng'
        }
      });
    } catch (error) {
      logger.error(`Check email error: ${error.message}`);
      next(error);
    }
  }

  // Refresh JWT token
  async refreshToken(req, res, next) {
    try {
      const jwt = require('jsonwebtoken');
      const config = require('../../config');

      const user = req.user;

      const newToken = jwt.sign(
        {
          id: user.id,
          userId: user.id,
          email: user.email,
          role: user.role
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expire }
      );

      res.json({
        success: true,
        message: 'Token được làm mới thành công',
        token: newToken
      });
    } catch (error) {
      logger.error(`Refresh token error: ${error.message}`);
      next(error);
    }
  }

  // Lấy thông tin creator profile
  async getCreatorProfile(req, res, next) {
    try {
      const userId = req.user.id;

      const creator = await Creator.findOne({
        where: { userId },
        include: [{
          model: User,
          as: 'user',
          attributes: { exclude: ['password'] }
        }]
      });

      if (!creator) {
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: 'Không tìm thấy creator profile',
          errors: ['Bạn chưa đăng ký làm creator']
        });
      }

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Lấy thông tin creator profile thành công',
        data: creator
      });

    } catch (error) {
      logger.error(`Get creator profile error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Promote an existing user to an admin role
   * @route   POST /api/v1/auth/users/:userId/promote-admin
   * @access  Private (Admin)
   */
  async promoteToAdmin(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, errors: errors.array() });
    }

    const { userId } = req.params;
    const { adminRole, permissions, notes } = req.body;

    try {
      const userToPromote = await User.findByPk(userId);
      if (!userToPromote) {
        return next(new ApiError('User not found.', StatusCodes.NOT_FOUND));
      }

      const result = await sequelize.transaction(async (t) => {
        await userToPromote.update({ role: 'admin' }, { transaction: t });

        await Admin.create({
          userId: userToPromote.id,
          role: adminRole || 'user',
          permissions: permissions || {},
          notes: notes || null,
        }, { transaction: t });

        return userToPromote;
      });

      const responseUser = { ...result.toJSON() };
      delete responseUser.password;

      res.status(StatusCodes.OK).json({
        success: true,
        message: `User ${result.username} has been successfully promoted to admin.`,
        data: responseUser,
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin tạo thông tin creator
  async adminCreateCreator(req, res, next) {
    try {
      const {
        firstName,
        lastName,
        phoneNumber,
        dateOfBirth,
        avatar,
        gender,
        country,
        city,
        timezone,
        language = 'vi',
        referralCode,
        stageName,
        titleBio,
        bio,
        bioUrls = [],
        tags = [],
        isVerified,
        hourlyRate,
        minBookingDuration,
        specialties = [],
        bodyType,
        height,
        weight,
        measurement,
        eyeColor,
        service,
        isTatto,
        signature,
        hairColor,
        cosmeticSurgery,
        bookingPrice,
        subscriptionPrice,
        availabilitySchedule = {}
      } = req.body;

      let username;
      let isUsernameUnique = false;
      while (!isUsernameUnique) {
        const randomString = Math.random().toString(36).substring(2, 8);
        username = `creator_${randomString}`;

        const existingUser = await User.findOne({
          where: { username: username.toLowerCase() }
        });

        if (!existingUser) {
          isUsernameUnique = true;
        }
      }

      // Tự động tạo email với format: creator_XXXXXX@platform.vn
      let email;
      let isEmailUnique = false;
      while (!isEmailUnique) {
        const randomString = Math.random().toString(36).substring(2, 8);
        email = `creator${randomString}@velvet.vn`;

        const existingUser = await User.findOne({
          where: { email: email.toLowerCase() }
        });

        if (!existingUser) {
          isEmailUnique = true;
        }
      }

      // Tự động tạo password với format: Creator123! + 4 ký tự ngẫu nhiên
      const randomPassword = Math.random().toString(36).substring(2, 6);
      const password = `Creator!${randomPassword}`;

      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const affiliateCode = crypto.randomBytes(8).toString('hex').toUpperCase();

      let referredBy = null;
      if (referralCode) {
        const referrer = await User.findOne({
          where: { affiliateCode: referralCode }
        });
        if (referrer) {
          referredBy = referrer.id;
        }
      }

      const user = await User.create({
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        password: hashedPassword,
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
        avatar,
        phoneNumber,
        dateOfBirth,
        gender,
        country,
        city,
        timezone,
        language,
        affiliateCode,
        referredBy,
        role: 'creator',
        registrationDate: new Date()
      });

      const userId = user.id;
      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: 'Không tìm thấy người dùng',
          errors: ['Không tìm thấy thông tin người dùng']
        });
      }

      const creator = await Creator.create({
        userId,
        stageName,
        titleBio,
        bio,
        bioUrls,
        tags,
        isVerified,
        hourlyRate,
        minBookingDuration,
        specialties,
        languages,
        bodyType,
        height,
        weight,
        measurement,
        eyeColor,
        service,
        isTatto,
        signature,
        hairColor,
        cosmeticSurgery,
        bookingPrice,
        subscriptionPrice,
        availabilitySchedule
      });

      const wallet = await Wallet.create({ userId: user.id });

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: 'Admin đã tạo profile creator thành công',
        data: {
          user: {
            id: user.id,
            email: email,
            username: username,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            affiliateCode: user.affiliateCode
          },
          creator: creator,
          credentials: {
            email: email,
            username: username,
            password: password, 
            note: 'Vui lòng lưu lại thông tin đăng nhập này và yêu cầu creator đổi mật khẩu sau lần đăng nhập đầu tiên'
          }
        }
      });

    } catch (error) {
      logger.error(`Admin creator error: ${error.message}`);
      next(error);
    }
  }
}

module.exports = new AuthController();