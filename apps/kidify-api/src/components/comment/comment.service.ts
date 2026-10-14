import { LikeService } from '../like/like.service';
import { LikeGroup } from '../../libs/enums/like.enum';
import { Order } from '../order/order';
import { Member } from '../../libs/dto/member/member';
import { ForbiddenException } from '@nestjs/common';
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';

import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ClientSession } from 'mongoose';
import { Product } from '../product/product';
import { BoardArticle } from '../../libs/dto/board-article/board-article';
import { atomic } from '../../libs/marketplace';
import { NotificationService } from '../notification/notification.service';
import { NotificationType, NotificationGroup } from '../../libs/enums/notification.enum';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';

import { MemberService } from '../member/member.service';
import { ProductService } from '../product/product.service';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { BoardArticleService } from '../board-article/board-article.service';

import { CommentInput, CommentsInquiry } from '../../libs/dto/comment/comment.input';

import { Direction, Message } from '../../libs/enums/common.enum';
import { CommentGroup, CommentStatus } from '../../libs/enums/comment.enum';

import { Comment, Comments } from '../../libs/dto/comment/comment';
import { CommentUpdate } from '../../libs/dto/comment/comment.update';

import { lookupMember } from '../../libs/config';
import { T } from '../../libs/types/common';

@Injectable()
export class CommentService {
	constructor(
        private readonly likes: LikeService,
        @InjectModel('Order') private readonly orders: Model<Order>,
		@InjectConnection() private readonly connection: Connection,
		@InjectModel('Product') private readonly products: Model<Product>,
		@InjectModel('BoardArticle') private readonly articles: Model<BoardArticle>,
		private readonly notifications: NotificationService,
		@InjectModel('Comment')
		private readonly commentModel: Model<Comment>,

		private readonly memberService: MemberService,
		private readonly productService: ProductService,
		private readonly boardArticleService: BoardArticleService,
	) {}

	public async createComment(memberId: mongoose.Types.ObjectId, input: CommentInput, actor?: Member): Promise<Comment> {
		const ref = shapeIntoMongoObjectId(input.commentRefId);
		if (![CommentGroup.PRODUCT, CommentGroup.ARTICLE].includes(input.commentGroup))
			throw new BadRequestException('INVALID_COMMENT_GROUP');
		return atomic(this.connection, async (session) => {
			const isProduct = input.commentGroup === CommentGroup.PRODUCT;
			const target = isProduct
				? await this.products.findOne({ _id: ref, productStatus: { $in: ['ACTIVE', 'SOLD_OUT'] } }).session(session)
				: await this.articles.findOne({ _id: ref, articleStatus: 'ACTIVE' }).session(session);
			if (!target) throw new BadRequestException('TARGET_NOT_FOUND');
            let verifiedPurchase = false;
            if (isProduct) {
                const purchase = await this.orders.findOne({ memberId, status: 'DELIVERED', paymentStatus: 'PAID', items: { $elemMatch: { productId: ref, status: 'DELIVERED' } } }).session(session);
                verifiedPurchase = !!purchase;
                const trustedActor = actor && String(actor._id) === String(memberId);
                const authorizedStaff = trustedActor && (actor.memberType === 'ADMIN' || (actor.memberType === 'SELLER' && String((target as Product).productSellerId) === String(memberId)));
                if (!purchase && !authorizedStaff) throw new BadRequestException('PURCHASE_REQUIRED_FOR_REVIEW');
            }
			const [comment] = await this.commentModel.create(
				[{ commentGroup: input.commentGroup, commentContent: input.commentContent, commentRefId: ref, memberId, verifiedPurchase }],
				{ session },
			);
			if (isProduct) await this.products.updateOne({ _id: ref }, { $inc: { productComments: 1 } }, { session });
			else await this.articles.updateOne({ _id: ref }, { $inc: { articleComments: 1 } }, { session });
			const owner = isProduct ? (target as Product).productSellerId : (target as BoardArticle).memberId;
			await this.notifications.send(
				owner,
				memberId,
				NotificationType.COMMENT,
				isProduct ? NotificationGroup.PRODUCT : NotificationGroup.ARTICLE,
				ref,
				'New comment',
				session,
			);
			return comment;
		});
	}

    async likeComment(memberId: mongoose.Types.ObjectId, id: mongoose.Types.ObjectId) {
        return atomic(this.connection, async session => {
            const comment = await this.commentModel.findOne({ _id: id, commentStatus: CommentStatus.ACTIVE }).session(session);
            if (!comment) throw new BadRequestException('COMMENT_NOT_FOUND');
            const delta = await this.likes.toggleLike({ memberId, likeRefId: id, likeGroup: LikeGroup.COMMENT }, session);
            return this.commentModel.findByIdAndUpdate(id, { $inc: { likeCount: delta } }, { new: true, session });
        });
    }
    async replyComment(actor: Member, id: mongoose.Types.ObjectId, text: string) {
        const comment = await this.commentModel.findOne({ _id: id, commentStatus: CommentStatus.ACTIVE });
        if (!comment) throw new BadRequestException('COMMENT_NOT_FOUND');
        const owns = comment.commentGroup === CommentGroup.PRODUCT && await this.products.exists({ _id: comment.commentRefId, productSellerId: actor._id });
        if (actor.memberType !== 'ADMIN' && !(actor.memberType === 'SELLER' && owns)) throw new ForbiddenException('FORBIDDEN');
        if (!text.trim() || text.length > 3000) throw new BadRequestException('INVALID_REPLY');
        return this.commentModel.findByIdAndUpdate(id, { $set: { replyText: text.trim(), replyAuthorId: actor._id } }, { new: true });
    }

	private async decrement(comment: Comment, session: ClientSession) {
		if (comment.commentGroup === CommentGroup.PRODUCT)
			await this.products.updateOne(
				{ _id: comment.commentRefId, productComments: { $gt: 0 } },
				{ $inc: { productComments: -1 } },
				{ session },
			);
		else if (comment.commentGroup === CommentGroup.ARTICLE)
			await this.articles.updateOne(
				{ _id: comment.commentRefId, articleComments: { $gt: 0 } },
				{ $inc: { articleComments: -1 } },
				{ session },
			);
	}

	public async updateComment(memberId: mongoose.Types.ObjectId, input: CommentUpdate): Promise<Comment> {
		return atomic(this.connection, async (session) => {
			const result = await this.commentModel.findOneAndUpdate(
				{ _id: input._id, memberId, commentStatus: CommentStatus.ACTIVE },
				{
					$set: {
						...(input.commentContent !== undefined ? { commentContent: input.commentContent } : {}),
						...(input.commentStatus ? { commentStatus: input.commentStatus } : {}),
					},
				},
				{ new: true, runValidators: true, session },
			);
			if (!result) throw new BadRequestException('COMMENT_NOT_FOUND');
			if (input.commentStatus === CommentStatus.DELETE) await this.decrement(result, session);
			return result;
		});
	}

	public async getComments(memberId: mongoose.Types.ObjectId, input: CommentsInquiry): Promise<Comments> {
		const { commentRefId } = input.search;

		const match: T = {
			commentRefId: commentRefId,
			commentStatus: CommentStatus.ACTIVE,
		};

		const sort: T = {
			[input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC,
		};

		const result: Comments[] = await this.commentModel.aggregate([
			{
				$match: match,
			},
			{
				$sort: sort,
			},
			{
				$facet: {
					list: [
						{
							$skip: (input.page - 1) * input.limit,
						},
						{
							$limit: input.limit,
						},
						lookupMember,
						{
							$unwind: '$memberData',
						},
					],

					metaCounter: [
						{
							$count: 'total',
						},
					],
				},
			},
		]);

		if (!result.length) {
			throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		}

		return result[0];
	}

	public async removeCommentByAdmin(input: mongoose.Types.ObjectId): Promise<Comment> {
		return atomic(this.connection, async (session) => {
			const result = await this.commentModel.findOneAndUpdate(
				{ _id: input, commentStatus: CommentStatus.ACTIVE },
				{ $set: { commentStatus: CommentStatus.DELETE } },
				{ new: true, session },
			);
			if (!result) throw new BadRequestException('COMMENT_NOT_FOUND');
			await this.decrement(result, session);
			return result;
		});
	}
}
