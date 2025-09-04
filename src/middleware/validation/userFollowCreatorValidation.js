const { body } = require('express-validator');
const { Creator } = require('../../models');

const followValidator = [
  body('creatorId')
    .notEmpty().withMessage('creatorId is required.')
    .isInt({ gt: 0 }).withMessage('creatorId must be a positive integer.')
    .custom(async (value, { req }) => {
      // Kiểm tra creator có tồn tại không
      const creator = await Creator.findByPk(value);
      if (!creator) {
        throw new Error('Creator does not exist.');
      }
      
      // Kiểm tra không follow chính mình (so sánh userId của creator với id của user hiện tại)
      if (creator.userId === req.user.id) {
        throw new Error('You cannot follow yourself.');
      }
      
      return true;
    }),
];

module.exports = {
  followValidator,
};