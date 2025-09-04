const { Gift } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { validationResult } = require('express-validator');
const logger = require('../../utils/logger');
const { Op } = require('sequelize');

class GiftController {
    // Tạo gift mới
    async createGift(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                console.log('Validation errors:', errors.array()); 
                return next(new ApiError(400, 'Validation error', errors.array()));
            }

            const { name, description, imageUrl, animationUrl, price, category, rarity } = req.body;

            const gift = await Gift.create({
                name,
                description,
                imageUrl,
                animationUrl,
                price,
                category,
                rarity: rarity || 'common'
            });

            res.status(201).json({
                success: true,
                data: gift
            });
        } catch (error) {
            logger.error('Error creating gift:', error);
            next(new ApiError(500, 'Internal server error'));
        }
    }

    // Lấy danh sách tất cả gifts
    async getAllGifts(req, res, next) {
        try {
            const { category, rarity, isActive = true } = req.query;
            
            const whereClause = { isActive };
            
            if (category) {
                whereClause.category = category;
            }
            
            if (rarity) {
                whereClause.rarity = rarity;
            }

            const gifts = await Gift.findAll({
                where: whereClause,
                order: [['createdAt', 'DESC']]
            });

            res.status(200).json({
                success: true,
                data: gifts
            });
        } catch (error) {
            logger.error('Error fetching gifts:', error);
            next(new ApiError(500, 'Internal server error'));
        }
    }

    // Lấy gift theo ID
    async getGiftById(req, res, next) {
        try {
            const { id } = req.params;

            const gift = await Gift.findOne({
                where: {
                    id,
                    isActive: true
                }
            });

            if (!gift) {
                return next(new ApiError(404, 'Gift not found'));
            }

            res.status(200).json({
                success: true,
                data: gift
            });
        } catch (error) {
            logger.error('Error fetching gift:', error);
            next(new ApiError(500, 'Internal server error'));
        }
    }

    // Cập nhật gift
    async updateGift(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return next(new ApiError(400, 'Validation error', errors.array()));
            }

            const { id } = req.params;
            const updateData = req.body;

            const gift = await Gift.findByPk(id);
            if (!gift) {
                return next(new ApiError(404, 'Gift not found'));
            }

            await gift.update(updateData);

            res.status(200).json({
                success: true,
                data: gift
            });
        } catch (error) {
            logger.error('Error updating gift:', error);
            next(new ApiError(500, 'Internal server error'));
        }
    }

    // Xóa gift (soft delete)
    async deleteGift(req, res, next) {
        try {
            const { id } = req.params;

            const gift = await Gift.findByPk(id);
            if (!gift) {
                return next(new ApiError(404, 'Gift not found'));
            }

            await gift.update({
                isActive: false
            });

            res.status(200).json({
                success: true,
                message: 'Gift deleted successfully'
            });
        } catch (error) {
            logger.error('Error deleting gift:', error);
            next(new ApiError(500, 'Internal server error'));
        }
    }

    // Lấy gifts theo category
    async getGiftsByCategory(req, res, next) {
        try {
            const { category } = req.params;

            const gifts = await Gift.findAll({
                where: {
                    category,
                    isActive: true
                },
                order: [['price', 'ASC']]
            });

            res.status(200).json({
                success: true,
                data: gifts
            });
        } catch (error) {
            logger.error('Error fetching gifts by category:', error);
            next(new ApiError(500, 'Internal server error'));
        }
    }

    // Lấy gifts theo rarity
    async getGiftsByRarity(req, res, next) {
        try {
            const { rarity } = req.params;

            const gifts = await Gift.findAll({
                where: {
                    rarity,
                    isActive: true
                },
                order: [['price', 'ASC']]
            });

            res.status(200).json({
                success: true,
                data: gifts
            });
        } catch (error) {
            logger.error('Error fetching gifts by rarity:', error);
            next(new ApiError(500, 'Internal server error'));
        }
    }

    // Tìm kiếm gifts
    async searchGifts(req, res, next) {
        try {
            const { q, category, rarity, minPrice, maxPrice } = req.query;

            const whereClause = { isActive: true };

            if (q) {
                whereClause[Op.or] = [
                    { name: { [Op.like]: `%${q}%` } },
                    { description: { [Op.like]: `%${q}%` } }
                ];
            }

            if (category) {
                whereClause.category = category;
            }

            if (rarity) {
                whereClause.rarity = rarity;
            }

            if (minPrice || maxPrice) {
                whereClause.price = {};
                if (minPrice) whereClause.price[Op.gte] = parseInt(minPrice);
                if (maxPrice) whereClause.price[Op.lte] = parseInt(maxPrice);
            }

            const gifts = await Gift.findAll({
                where: whereClause,
                order: [['createdAt', 'DESC']]
            });

            res.status(200).json({
                success: true,
                data: gifts
            });
        } catch (error) {
            logger.error('Error searching gifts:', error);
            next(new ApiError(500, 'Internal server error'));
        }
    }
}

module.exports = new GiftController();