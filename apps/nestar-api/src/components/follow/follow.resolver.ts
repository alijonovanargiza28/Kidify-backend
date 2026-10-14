import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FollowService } from './follow.service';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { WithoutGuard } from '../auth/guards/without.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Types } from 'mongoose';
import { Follower, Followers, Followings } from '../../libs/dto/follow/follow';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { PageInquiry } from '../../libs/marketplace';
import { FollowInquiry } from '../../libs/dto/follow/follow.input';

@Resolver()
export class FollowResolver {
	constructor(private readonly followService: FollowService) {}

	@UseGuards(AuthGuard)
	@Mutation(() => Follower)
	public async subscribe(@Args('input') input: string, @AuthMember('_id') memberId: Types.ObjectId): Promise<Follower> {
		console.log('Mutation: Subscribe');

		const followingId = shapeIntoMongoObjectId(input);

		return await this.followService.subscribe(memberId, followingId);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Follower, { nullable: true })
	public async unsubscribe(
		@Args('input') input: string,
		@AuthMember('_id') memberId: Types.ObjectId,
	): Promise<Follower | null> {
		console.log('Mutation: unsubscribe');

		const followingId = shapeIntoMongoObjectId(input);

		return await this.followService.unsubscribe(followingId, memberId);
	}

	@UseGuards(WithoutGuard)
	@Query(() => Followings)
	public async getMemberFollowings(
		@Args('input') input: FollowInquiry,
		@AuthMember('_id') memberId: Types.ObjectId,
	): Promise<Followings> {
		console.log('Query: getMemberFollowings');

		const { followerId } = input.search;

		if (followerId) {
			input.search.followerId = shapeIntoMongoObjectId(followerId);
		}

		return await this.followService.getMemberFollowings(memberId, input);
	}

	@UseGuards(WithoutGuard)
	@Query(() => Followers)
	public async getMemberFollowers(
		@Args('input') input: FollowInquiry,
		@AuthMember('_id') memberId: Types.ObjectId,
	): Promise<Followers> {
		console.log('Query: getMemberFollowers');

		const { followingId } = input.search;

		if (followingId) {
			input.search.followingId = shapeIntoMongoObjectId(followingId);
		}

		return await this.followService.getMemberFollowers(memberId, input);
	}
	@UseGuards(AuthGuard)
	@Query(() => Followings)
	getMyFollowings(@Args('input') input: PageInquiry, @AuthMember('_id') memberId: Types.ObjectId) {
		return this.followService.getMemberFollowings(memberId, {
			page: input.page,
			limit: input.limit,
			search: { followerId: memberId },
		});
	}
	@UseGuards(WithoutGuard)
	@Query(() => Followers)
	getSellerFollowers(
		@Args('sellerId') id: string,
		@Args('input') input: PageInquiry,
		@AuthMember('_id') memberId: Types.ObjectId,
	) {
		return this.followService.getMemberFollowers(memberId, {
			page: input.page,
			limit: input.limit,
			search: { followingId: shapeIntoMongoObjectId(id) },
		});
	}
}
