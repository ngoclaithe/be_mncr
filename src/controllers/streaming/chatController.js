const {Chat, Wallet, Gift, Transaction, Stream} = require('../../models');
const ApiError = require('../../utils/ApiError');
const { validationResult } = require('express-validator');
const logger = require('../../utils/logger');
const { Op } = require('sequelize');

class ChatController {
    async createMessage(req, res, next) {
        try {
            console.log("Giá trị của req là:", req.body);
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return next(new ApiError(400, 'Validation error', errors.array()));
            }
            const { streamId, message, messageType, giftId, quantity } = req.body;
            const userId = req.user.id;

            // Xử lý khi message type là gift
            if (messageType === 'gift' && giftId) {
                // Kiểm tra gift có tồn tại và active không
                const gift = await Gift.findOne({
                    where: { 
                        id: giftId, 
                        isActive: true 
                    }
                });

                if (!gift) {
                    return res.status(200).json({
                        success: false,
                        error: 'GIFT_NOT_FOUND',
                        message: 'Gift không tồn tại hoặc không còn hoạt động'
                    });
                }

                // Lấy thông tin stream để biết creatorId
                const stream = await Stream.findByPk(streamId);
                if (!stream) {
                    return res.status(200).json({
                        success: false,
                        error: 'STREAM_NOT_FOUND',
                        message: 'Stream không tồn tại'
                    });
                }

                // Tính tổng chi phí
                const totalCost = gift.price * (quantity || 1);

                // Kiểm tra wallet của user
                const wallet = await Wallet.findOne({
                    where: { userId: userId }
                });

                if (!wallet) {
                    return res.status(200).json({
                        success: false,
                        error: 'WALLET_NOT_FOUND',
                        message: 'Không tìm thấy ví của bạn. Vui lòng liên hệ hỗ trợ.'
                    });
                }

                // Kiểm tra số dư token
                if (wallet.tokens < totalCost) {
                    return res.status(200).json({
                        success: false,
                        error: 'INSUFFICIENT_TOKENS',
                        message: `Số dư token không đủ. Bạn cần ${totalCost} tokens nhưng chỉ có ${wallet.tokens} tokens. Vui lòng nạp thêm token để tiếp tục.`,
                        data: {
                            required: totalCost,
                            current: wallet.tokens,
                            shortage: totalCost - wallet.tokens
                        }
                    });
                }

                // Trừ token từ wallet
                await wallet.update({
                    tokens: wallet.tokens - totalCost
                });

                // Tạo bản ghi transaction
                await Transaction.create({
                    fromUserId: userId,
                    toUserId: stream.creatorId, // Lấy creatorId từ stream
                    type: 'donation',
                    amount: 0, // Gift không có amount tiền tệ
                    tokenAmount: totalCost,
                    currency: 'TOKEN',
                    status: 'completed',
                    description: `Gửi gift ${gift.name} x${quantity || 1} trong stream ${streamId}`,
                    streamId: streamId,
                    referenceId: `GIFT_${Date.now()}_${userId}`
                });
            }

            // Tạo message mới
            const chat = await Chat.create({ 
                streamId, 
                senderId: userId, 
                message, 
                messageType, 
                giftId, 
                quantity 
            });

            // Xử lý giới hạn message text (giữ nguyên logic cũ)
            if (messageType === 'text') {
                const messageCount = await Chat.count({
                    where: {
                        streamId: streamId,
                        messageType: 'text',
                        isDeleted: false
                    }
                });

                if (messageCount > 50) {
                    const messagesToDelete = messageCount - 50;
                    
                    const oldMessages = await Chat.findAll({
                        where: {
                            streamId: streamId,
                            messageType: 'text',
                            isDeleted: false
                        },
                        order: [['createdAt', 'ASC']],
                        limit: messagesToDelete
                    });

                    const oldMessageIds = oldMessages.map(msg => msg.id);
                    await Chat.update(
                        { 
                            isDeleted: true,
                            deletedAt: new Date(),
                            deletedBy: userId
                        },
                        {
                            where: {
                                id: {
                                    [Op.in]: oldMessageIds
                                }
                            }
                        }
                    );
                }
            }

            res.status(201).json({
                success: true,
                message: messageType === 'gift' ? 'Gift đã được gửi thành công' : 'Message đã được tạo thành công',
                data: chat
            });
        } catch (error) {
            logger.error('Error sending chat message:', error);
            next(new ApiError(500, 'Internal server error'));
        }
    }

    async getMessages(req, res, next) {
        try {
            const { streamId } = req.params;

            const messages = await Chat.findAll({ 
                where: { 
                    streamId: streamId,
                    isDeleted: false
                },
                order: [['createdAt', 'DESC']],
                limit: 50
            });
            
            res.status(200).json(messages.reverse()); 
        } catch (error) {
            logger.error('Error fetching chat messages:', error);
            next(new ApiError(500, 'Internal server error'));
        }
    }

    async deleteMessage(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const chat = await Chat.findByPk(id);
            if (!chat) {
                return next(new ApiError(404, 'Chat message not found'));
            }

            // Soft delete
            await chat.update({
                isDeleted: true,
                deletedAt: new Date(),
                deletedBy: userId
            });
            
            res.status(204).send();
        } catch (error) {
            logger.error('Error deleting chat message:', error);
            next(new ApiError(500, 'Internal server error'));
        }
    }
}

module.exports = new ChatController();