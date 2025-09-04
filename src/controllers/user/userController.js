const { User, Creator, Follow, sequelize } = require('../../models');
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../../utils/ApiError');
const { validationResult } = require('express-validator');

const getPublicInfoUser = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Tìm thông tin user
        const user = await User.findByPk(id, {
            attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
        });

        if (!user) {
            throw new ApiError('User not found', StatusCodes.NOT_FOUND);
        }

        // Tìm danh sách following với thông tin creator
        const followingList = await Follow.findAll({
            where: { followerId: id },
            include: [
                {
                    model: Creator,
                    as: 'creator',
                    attributes: ['id', 'stageName'], // Thêm stageName
                    include: [
                        {
                            model: User,
                            as: 'user',
                            attributes: ['id', 'username', 'firstName', 'lastName', 'avatar']
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Transform data để có định dạng mong muốn
        const transformedFollowing = followingList.map(follow => {
            const creator = follow.creator;
            const creatorUser = creator.user;
            return {
                creatorId: creator.id,
                stageName: creator.stageName, // Thêm stageName
                userId: creatorUser.id,
                username: creatorUser.username,
                firstName: creatorUser.firstName,
                lastName: creatorUser.lastName,
                avatar: creatorUser.avatar,
                followedAt: follow.createdAt // Thời gian follow
            };
        });

        // Tính số lượng người đang follow
        const followingCount = transformedFollowing.length;

        // Trả về response với đầy đủ thông tin
        res.status(StatusCodes.OK).json({
            success: true,
            message: 'User public information retrieved successfully',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    avatar: user.avatar
                },
                followingCount: followingCount,
                following: transformedFollowing
            }
        });

    } catch (error) {
        next(error);
    }
};

module.exports = getPublicInfoUser;