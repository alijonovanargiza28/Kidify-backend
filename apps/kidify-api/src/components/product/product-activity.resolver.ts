import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Injectable, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Like } from '../../libs/dto/like/like';
import { View } from '../../libs/dto/view/view';
import { Products } from './product';
import { BoardArticles } from '../../libs/dto/board-article/board-article';
import { LikeGroup } from '../../libs/enums/like.enum';
import { ViewGroup } from '../../libs/enums/view.enum';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { PageInquiry, facet } from '../../libs/marketplace';
import { presentProduct } from './product.service';
@Injectable()
export class ProductActivityService {
	constructor(
		@InjectModel('like') private readonly likes: Model<Like>,
		@InjectModel('View') private readonly views: Model<View>,
	) {}
	async list(memberId: Types.ObjectId, input: PageInquiry, visited = false, article = false) {
		const group = article ? LikeGroup.ARTICLE : LikeGroup.PRODUCT;
		const model = visited ? this.views : this.likes;
		const ref = visited ? 'viewRefId' : 'likeRefId';
		const data = (
			await model.aggregate([
				{ $match: { memberId, [visited ? 'viewGroup' : 'likeGroup']: visited ? ViewGroup.PRODUCT : group } },
				{ $sort: { updatedAt: input.oldest ? 1 : -1, _id: -1 } },
				{
					$lookup: { from: article ? 'boardArticles' : 'products', localField: ref, foreignField: '_id', as: 'target' },
				},
				{ $unwind: '$target' },
				{
					$match: {
						[article ? 'target.articleStatus' : 'target.productStatus']: {
							$in: article ? ['ACTIVE'] : ['ACTIVE', 'SOLD_OUT'],
						},
					},
				},
				...(!article
					? [
							{ $lookup: { from: 'members', localField: 'target.productSellerId', foreignField: '_id', as: 'seller' } },
							{ $match: { 'seller.memberStatus': 'ACTIVE' } },
						]
					: []),
				{ $replaceRoot: { newRoot: '$target' } },
				facet(input),
			])
		)[0];
		if (!article) data.list = data.list.map((product) => presentProduct({ ...product, ...(!visited ? { meLiked: [{ memberId, likeRefId: product._id, myFavorite: true }] } : {}) }));
		return data;
	}
	async clear(memberId: Types.ObjectId) {
		await this.views.deleteMany({ memberId, viewGroup: ViewGroup.PRODUCT });
		return true;
	}
}
@Resolver()
@UseGuards(AuthGuard)
export class ProductActivityResolver {
	constructor(private readonly service: ProductActivityService) {}
	@Query(() => Products) getMyFavoriteProducts(
		@Args('input') input: PageInquiry,
		@AuthMember('_id') memberId: Types.ObjectId,
	) {
		return this.service.list(memberId, input);
	}
	@Query(() => BoardArticles) getMyLikedArticles(
		@Args('input') input: PageInquiry,
		@AuthMember('_id') memberId: Types.ObjectId,
	) {
		return this.service.list(memberId, input, false, true);
	}
	@Query(() => Products) getRecentlyVisitedProducts(
		@Args('input') input: PageInquiry,
		@AuthMember('_id') memberId: Types.ObjectId,
	) {
		return this.service.list(memberId, input, true);
	}
	@Mutation(() => Boolean) clearRecentlyVisited(@AuthMember('_id') memberId: Types.ObjectId) {
		return this.service.clear(memberId);
	}
}
