import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Follower, Following, Followers, Followings } from '../../libs/dto/follow/follow';
import { MemberService } from '../member/member.service';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { atomic } from '../../libs/marketplace';
import { Member } from '../../libs/dto/member/member';
import { NotificationService } from '../notification/notification.service';
import { NotificationGroup, NotificationType } from '../../libs/enums/notification.enum';
import { Model, Types } from 'mongoose';
import { Direction, Message } from '../../libs/enums/common.enum';
import { FollowInquiry } from '../../libs/dto/follow/follow.input';
import {
	lookupFollowingData,
	lookupFollowerData,
	lookupAuthMemberLiked,
	lookupAuthMemberFollowed,
} from '../../libs/config';

@Injectable()
export class FollowService {
	constructor(
		@InjectConnection() private readonly connection: Connection,
		@InjectModel('Member') private readonly members: Model<Member>,
		private readonly notifications: NotificationService,
		@InjectModel('Follow')
		private readonly followModel: Model<Follower | Following>,
		private readonly memberService: MemberService,
	) {}

	// =========================================================
	// SUBSCRIBE
	// =========================================================

	public async subscribe(followerId: Types.ObjectId, followingId: Types.ObjectId): Promise<Follower> {
		if (followerId.toString() === followingId.toString()) {
			throw new InternalServerErrorException(Message.SELF_SUBSCRIPTION_DENIED);
		}

        try {
		return await atomic(this.connection, async (session) => {
			const seller = await this.members
				.findOne({ _id: followingId, memberType: 'SELLER', memberStatus: 'ACTIVE' })
				.session(session);
			if (!seller) throw new BadRequestException('SELLER_NOT_FOUND');
			const existing = await this.followModel.findOne({ followerId, followingId }).session(session);
			if (existing) return existing as Follower;
			const [result] = await this.followModel.create([{ followerId, followingId }], { session });
			await this.members.updateOne({ _id: followerId }, { $inc: { memberFollowings: 1 } }, { session });
			await this.members.updateOne({ _id: followingId }, { $inc: { memberFollowers: 1 } }, { session });
			await this.notifications.send(
				followingId,
				followerId,
				NotificationType.FOLLOW,
				NotificationGroup.MEMBER,
				followerId,
				'New follower',
				session,
			);
			return result as Follower;
		});
        } catch (error) {
            if ((error as { code?: number }).code === 11000) {
                const existing = await this.followModel.findOne({ followerId, followingId });
                if (existing) return existing as Follower;
                throw new BadRequestException('FOLLOW_RETRY');
            }
            throw error;
        }
	}

	// =========================================================
	// REGISTER SUBSCRIPTION
	// =========================================================

	private async registerSubscription(followerId: Types.ObjectId, followingId: Types.ObjectId): Promise<Follower> {
		try {
			return (await this.followModel.create({
				followerId,
				followingId,
			})) as Follower;
		} catch (err) {
			console.log('Error ServiceModel', err);

			throw new BadRequestException(Message.CREATE_FAILED);
		}
	}

	// =========================================================
	// UNSUBSCRIBE
	// =========================================================

	public async unsubscribe(followingId: Types.ObjectId, followerId: Types.ObjectId): Promise<Follower | null> {
		return atomic(this.connection, async (session) => {
			const result = await this.followModel.findOneAndDelete({ followingId, followerId }, { session });
			if (!result) return null;
			await this.members.updateOne(
				{ _id: followerId, memberFollowings: { $gt: 0 } },
				{ $inc: { memberFollowings: -1 } },
				{ session },
			);
			await this.members.updateOne(
				{ _id: followingId, memberFollowers: { $gt: 0 } },
				{ $inc: { memberFollowers: -1 } },
				{ session },
			);
			return result as Follower;
		});
	}

	// =========================================================
	// GET MEMBER FOLLOWINGS
	// =========================================================

	public async getMemberFollowings(memberId: Types.ObjectId, input: FollowInquiry): Promise<Followings> {
		const { page, limit, search } = input;

		if (!search?.followerId) {
			throw new InternalServerErrorException(Message.BAD_REQUEST);
		}

		const match = {
			followerId: search.followerId,
		};

		console.log('match:', match);

		const result = await this.followModel
			.aggregate([
				{
					$match: match,
				},

				{
					$sort: {
						createdAt: Direction.DESC,
					},
				},

				{
					$facet: {
						list: [
							{
								$skip: (page - 1) * limit,
							},

							{
								$limit: limit,
							},

							lookupAuthMemberLiked(memberId, '$followingId'),
							lookupAuthMemberFollowed({
								followerId: memberId,
								followingId: '$followingId',
							})(memberId, '$followingId'),

							lookupFollowingData,

							{
								$unwind: '$followingData',
							},
						],

						metaCounter: [
							{
								$count: 'total',
							},
						],
					},
				},
			])
			.exec();

		if (!result?.length) {
			throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		}

		return result[0];
	}

	// =========================================================
	// GET MEMBER FOLLOWERS
	// =========================================================

	public async getMemberFollowers(memberId: Types.ObjectId, input: FollowInquiry): Promise<Followers> {
		const { page, limit, search } = input;

		if (!search?.followingId) {
			throw new InternalServerErrorException(Message.BAD_REQUEST);
		}

		const match = {
			followingId: search.followingId,
		};

		console.log('match:', match);

		const result = await this.followModel
			.aggregate([
				{
					$match: match,
				},

				{
					$sort: {
						createdAt: Direction.DESC,
					},
				},

				{
					$facet: {
						list: [
							{
								$skip: (page - 1) * limit,
							},

							{
								$limit: limit,
							},

							// Member liked this follower member
							lookupAuthMemberLiked(memberId, '$followerId'),

							// Member followed this follower member
							lookupAuthMemberFollowed({
								followerId: memberId,
								followingId: '$followerId',
							})(memberId, '$followerId'),

							// Get follower member data
							lookupFollowerData,

							{
								$unwind: '$followerData',
							},
						],

						metaCounter: [
							{
								$count: 'total',
							},
						],
					},
				},
			])
			.exec();

		if (!result?.length) {
			throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		}

		return result[0];
	}
}
