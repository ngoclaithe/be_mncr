const { body } = require('express-validator');

const VALID_REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];

const toggleReactionValidator = [
  body('reactionType')
    .trim()
    .notEmpty().withMessage('Reaction type is required.')
    .isIn(VALID_REACTION_TYPES)
    .withMessage(`Invalid reaction type. Must be one of: ${VALID_REACTION_TYPES.join(', ')}`)
];

module.exports = {
  toggleReactionValidator,
};