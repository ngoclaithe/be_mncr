// validation/index.js

const commonValidation = require('./commonValidation');
const authValidation = require('./authValidation');
const userValidation = require('./userValidation');
const creatorValidation = require('./creatorValidation');
const kycValidation = require('./kycValidation');
const postValidation = require('./postValidation');
const validateRequest = (validationSchema) => {
  return (req, res, next) => {
    const errors = {};

    // Validate body
    if (validationSchema.body) {
      const { error } = validationSchema.body.validate(req.body, { abortEarly: false });
      if (error) {
        errors.body = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
      }
    }

    // Validate query
    if (validationSchema.query) {
      const { error, value } = validationSchema.query.validate(req.query, { abortEarly: false });
      if (error) {
        errors.query = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
      } else {
        req.query = value; // Apply defaults
      }
    }

    // Validate params
    if (validationSchema.params) {
      const { error } = validationSchema.params.validate(req.params, { abortEarly: false });
      if (error) {
        errors.params = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    next();
  };
};
module.exports = {
    validateRequest,
    ...commonValidation,
    ...authValidation,
    ...userValidation,
    ...creatorValidation,
    ...kycValidation,
    ...postValidation
};