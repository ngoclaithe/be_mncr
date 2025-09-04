// validation/commonValidation.js
const { validationResult, matchedData } = require('express-validator');
const ApiError = require('../../utils/ApiError');
const { StatusCodes } = require('http-status-codes');

/**
 * Middleware xử lý kết quả validate từ express-validator
 */
const validate = (validations) => {
    return async (req, res, next) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);

        if (errors.isEmpty()) {
            req.validatedData = matchedData(req, { includeOptionals: true });
            return next();
        }

        const extractedErrors = [];
        errors.array().map(err => extractedErrors.push({ [err.param]: err.msg }));

        next(
            new ApiError(
                'Dữ liệu không hợp lệ',
                StatusCodes.BAD_REQUEST,
                extractedErrors
            )
        );
    };
};

// Tạo các rule validate từ schema
const createValidationRules = (schema) => {
    const rules = [];

    for (const [field, rule] of Object.entries(schema)) {
        const { method, ...options } = rule;
        const validation = [];

        // Thêm các rule validate
        for (const [key, value] of Object.entries(options)) {
            if (typeof value === 'object' && value !== null) {
                validation.push([key, value]);
            } else {
                validation.push([key, { errorMessage: value }]);
            }
        }

        // Thêm rule vào mảng rules
        rules.push([field, ...validation]);
    }

    return rules;
};

// Middleware kiểm tra định dạng file ảnh
const imageFileFilter = (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
        return cb(
            new ApiError('Chỉ chấp nhận file ảnh', StatusCodes.BAD_REQUEST),
            false
        );
    }
    cb(null, true);
};

// Middleware kiểm tra kích thước file
const checkFileSize = (maxSizeInMB) => (req, file, cb) => {
    const maxSize = maxSizeInMB * 1024 * 1024; // Chuyển đổi sang bytes

    if (file.size > maxSize) {
        return cb(
            new ApiError(
                `Kích thước file vượt quá giới hạn cho phép (${maxSizeInMB}MB)`,
                StatusCodes.BAD_REQUEST
            ),
            false
        );
    }

    cb(null, true);
};

module.exports = {
    validate,
    createValidationRules,
    imageFileFilter,
    checkFileSize
};