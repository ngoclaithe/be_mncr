const { User, Creator, Booking, Notification, Review } = require('../../models');
const { StatusCodes } = require('http-status-codes');
const { validationResult } = require('express-validator');
const mqttService = require('../../services/mqtt/mqtt');
const logger = require('../../utils/logger');

const postReview = async (req, res) => {
    try {
        // Validate request
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { bookingId, creatorId, rating, comment, images = [], isAnonymous = false, isPublic = true } = req.body;
        const userId = req.user.id;

        // Validate creator exists
        const creator = await Creator.findByPk(creatorId);
        if (!creator) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Creator not found'
            });
        }

        // If bookingId is provided, validate booking exists and belongs to user
        if (bookingId) {
            const booking = await Booking.findOne({
                where: {
                    id: bookingId,
                    userId: userId,
                    creatorId: creatorId
                }
            });

            if (!booking) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    success: false,
                    message: 'Booking not found or you are not authorized to review this booking'
                });
            }

            // Check if review already exists for this booking
            const existingReview = await Review.findOne({
                where: {
                    bookingId: bookingId,
                    userId: userId
                }
            });

            if (existingReview) {
                return res.status(StatusCodes.CONFLICT).json({
                    success: false,
                    message: 'Review already exists for this booking'
                });
            }
        } else {
            // For reviews without bookingId, check if user has already reviewed this creator
            const existingReview = await Review.findOne({
                where: {
                    userId: userId,
                    creatorId: creatorId,
                    bookingId: null
                }
            });

            if (existingReview) {
                return res.status(StatusCodes.CONFLICT).json({
                    success: false,
                    message: 'You have already reviewed this creator'
                });
            }
        }

        // Create review
        const review = await Review.create({
            bookingId,
            userId,
            creatorId,
            rating,
            comment,
            images,
            isAnonymous,
            isPublic
        });

        // Create notification for creator
        await Notification.create({
            userId: creatorId,
            type: 'review',
            title: 'New Review Received',
            message: `You received a new ${rating}-star review`,
            data: {
                reviewId: review.id,
                rating: rating,
                isAnonymous: isAnonymous
            }
        });
        // Fetch review with user data for response
        const reviewWithData = await Review.findByPk(review.id, {
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
                },
                {
                    model: Creator,
                    as: 'creator',
                    attributes: ['id', 'stageName']
                }
            ]
        });

        logger.info(`Review created: ${review.id} by user ${userId} for creator ${creatorId}`);

        res.status(StatusCodes.CREATED).json({
            success: true,
            message: 'Review created successfully',
            data: reviewWithData
        });

    } catch (error) {
        logger.error('Error creating review:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getReviews = async (req, res) => {
    try {
        const { creatorId } = req.params;
        const { page = 1, limit = 10, rating, sortBy = 'createdAt', order = 'desc' } = req.query;

        // Build where clause
        const where = {
            creatorId: creatorId,
            isPublic: true
        };

        if (rating) {
            where.rating = rating;
        }

        const offset = (page - 1) * limit;

        const reviews = await Review.findAndCountAll({
            where,
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'username','firstName', 'lastName', 'avatar']
                }
            ],
            order: [[sortBy, order.toUpperCase()]],
            limit: parseInt(limit),
            offset: offset
        });

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                reviews: reviews.rows,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(reviews.count / limit),
                    totalItems: reviews.count,
                    limit: parseInt(limit)
                }
            }
        });

    } catch (error) {
        logger.error('Error fetching reviews:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getReviewById = async (req, res) => {
    try {
        const { id } = req.params;

        const review = await Review.findByPk(id, {
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'username','firstName', 'lastName', 'avatar']
                },
                {
                    model: Creator,
                    as: 'creator',
                    attributes: ['id', 'stageName']
                }
            ]
        });

        if (!review) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Review not found'
            });
        }

        // Check if review is public or user is authorized to view
        if (!review.isPublic && review.userId !== req.user.id && review.creatorId !== req.user.id) {
            return res.status(StatusCodes.FORBIDDEN).json({
                success: false,
                message: 'You are not authorized to view this review'
            });
        }

        res.status(StatusCodes.OK).json({
            success: true,
            data: review
        });

    } catch (error) {
        logger.error('Error fetching review:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const updateReview = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { id } = req.params;
        const { rating, comment, images, isAnonymous, isPublic } = req.body;
        const userId = req.user.id;

        const review = await Review.findOne({
            where: {
                id: id,
                userId: userId
            }
        });

        if (!review) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Review not found or you are not authorized to update it'
            });
        }

        // Update review
        await review.update({
            rating,
            comment,
            images,
            isAnonymous,
            isPublic
        });

        const updatedReview = await Review.findByPk(id, {
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
                },
                {
                    model: Creator,
                    as: 'creator',
                    attributes: ['id', 'stageName']
                }
            ]
        });

        logger.info(`Review updated: ${id} by user ${userId}`);

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Review updated successfully',
            data: updatedReview
        });

    } catch (error) {
        logger.error('Error updating review:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const deleteReview = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const review = await Review.findOne({
            where: {
                id: id,
                userId: userId
            }
        });

        if (!review) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Review not found or you are not authorized to delete it'
            });
        }

        await review.destroy();

        logger.info(`Review deleted: ${id} by user ${userId}`);

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Review deleted successfully'
        });

    } catch (error) {
        logger.error('Error deleting review:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getUserPublicReviews = async (req, res) => {
    try {
        const { userId } = req.params; // Lấy userId từ params
        const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = req.query;

        // Validate userId
        if (!userId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'User ID is required'
            });
        }

        // Validate user exists
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'User not found'
            });
        }

        const offset = (page - 1) * limit;

        const reviews = await Review.findAndCountAll({
            where: {
                userId: userId
            },
            include: [
                {
                    model: Creator,
                    as: 'creator',
                    attributes: ['id', 'stageName'],
                    include: [
                        {
                            model: User,
                            as: 'user', // Giả sử association name là 'user'
                            attributes: ['avatar']
                        }
                    ]
                }
            ],
            order: [[sortBy, order.toUpperCase()]],
            limit: parseInt(limit),
            offset: offset
        });

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                reviews: reviews.rows,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(reviews.count / limit),
                    totalItems: reviews.count,
                    limit: parseInt(limit)
                }
            }
        });

    } catch (error) {
        logger.error('Error fetching my reviews:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const respondToReview = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { id } = req.params;
        const { adminResponse } = req.body;
        const creatorId = req.user.id;

        const review = await Review.findOne({
            where: {
                id: id,
                creatorId: creatorId
            }
        });

        if (!review) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Review not found or you are not authorized to respond'
            });
        }

        await review.update({
            adminResponse: adminResponse
        });

        // Create notification for reviewer
        await Notification.create({
            userId: review.userId,
            type: 'review_response',
            title: 'Creator Responded to Your Review',
            message: 'A creator has responded to your review',
            data: {
                reviewId: review.id,
                creatorId: creatorId
            }
        });

        logger.info(`Review response added: ${id} by creator ${creatorId}`);

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Response added successfully'
        });

    } catch (error) {
        logger.error('Error responding to review:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    postReview,
    getReviews,
    getReviewById,
    updateReview,
    deleteReview,
    getUserPublicReviews,
    respondToReview
};