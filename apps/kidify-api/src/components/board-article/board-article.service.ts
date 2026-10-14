import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { atomic } from '../../libs/marketplace';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { BoardArticle, BoardArticles } from '../../libs/dto/board-article/board-article';

import {
	AllBoardArticlesInquiry,
	BoardArticleInput,
	BoardArticlesInquiry,
} from '../../libs/dto/board-article/board-article.input';

import { BoardArticleUpdate } from '../../libs/dto/board-article/board-article.update';

import { MemberService } from '../member/member.service';
import { ViewService } from '../view/view.service';

import { Direction, Message } from '../../libs/enums/common.enum';
import { ViewGroup } from '../../libs/enums/view.enum';
import { BoardArticleStatus } from '../../libs/enums/board-article.enum';

import { StatisticModifier, T } from '../../libs/types/common';

import { lookupAuthMemberLiked, lookupMember, shapeIntoMongoObjectId } from '../../libs/config';

import { LikeService } from '../like/like.service';
import { LikeInput } from '../../libs/dto/like/like.input';
import { escapeSearch } from '../../libs/marketplace';
import { NotificationService } from '../notification/notification.service';
import { NotificationType, NotificationGroup } from '../../libs/enums/notification.enum';
import { LikeGroup } from '../../libs/enums/like.enum';

@Injectable()
export class BoardArticleService {
	constructor(
		@InjectConnection() private readonly connection: Connection,
		private readonly notifications: NotificationService,
		@InjectModel('BoardArticle')
		private readonly boardArticleModel: Model<BoardArticle>,

		private readonly memberService: MemberService,
		private readonly viewService: ViewService,
		private readonly likeService: LikeService,
	) {}

	// CREATE BOARD ARTICLE
	public async createBoardArticle(memberId: Types.ObjectId, input: BoardArticleInput): Promise<BoardArticle> {
		return atomic(this.connection, async (session) => {
			const [article] = await this.boardArticleModel.create([{ ...input, memberId }], { session });
			await this.memberService.memberStatusEditor({ _id: memberId, targetKey: 'memberArticles', modifier: 1 }, session);
			return article;
		});
	}

	// GET ONE BOARD ARTICLE
	public async getBoardArticle(memberId: Types.ObjectId, articleId: Types.ObjectId): Promise<BoardArticle> {
		const search: T = {
			_id: articleId,
			articleStatus: BoardArticleStatus.ACTIVE,
		};

		const targetBoardArticle: BoardArticle | null = await this.boardArticleModel.findOne(search).lean().exec();

		if (!targetBoardArticle) {
			throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		}

		// RECORD VIEW
		if (memberId) {
			const viewInput = {
				memberId: memberId,
				viewRefId: articleId,
				viewGroup: ViewGroup.ARTICLE,
			};

			const newView = await this.viewService.recordView(viewInput);

			if (newView) {
				await this.boardArticleStatusEditor({
					_id: articleId,
					targetKey: 'articleViews',
					modifier: 1,
				});

				targetBoardArticle.articleViews++;
			}

			// CHECK LIKE
			const likeInput: LikeInput = {
				memberId: memberId,
				likeRefId: articleId,
				likeGroup: LikeGroup.ARTICLE,
			};

			targetBoardArticle.meLiked = await this.likeService.checkLikeExistence(likeInput);
		}

		// GET MEMBER DATA
		targetBoardArticle.memberData = await this.memberService.getMember(
			null,
			shapeIntoMongoObjectId(targetBoardArticle.memberId),
		);

		return targetBoardArticle;
	}

	// UPDATE BOARD ARTICLE
	public async updateBoardArticle(memberId: Types.ObjectId, input: BoardArticleUpdate): Promise<BoardArticle> {
		const { _id, articleStatus } = input;

		const articleId = shapeIntoMongoObjectId(_id);

		const result = await this.boardArticleModel
			.findOneAndUpdate(
				{
					_id: articleId,
					memberId: memberId,
					articleStatus: BoardArticleStatus.ACTIVE,
				},
				input,
				{
					new: true,
				},
			)
			.exec();

		if (!result) {
			throw new InternalServerErrorException(Message.UPDATE_FAILED);
		}

		if (articleStatus === BoardArticleStatus.DELETE) {
			await this.memberService.memberStatusEditor({
				_id: memberId,
				targetKey: 'memberArticles',
				modifier: -1,
			});
		}

		return result;
	}

	// GET BOARD ARTICLES
	public async getBoardArticles(memberId: Types.ObjectId, input: BoardArticlesInquiry): Promise<BoardArticles> {
		const { articleCategory, text } = input.search;

		const match: T = {
			articleStatus: BoardArticleStatus.ACTIVE,
		};

		const sort: T = {
			[input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC,
		};

		// CATEGORY SEARCH
		if (articleCategory) {
			match.articleCategory = articleCategory;
		}

		// TEXT SEARCH
		if (text) {
			match.articleTitle = {
				$regex: new RegExp(escapeSearch(text), 'i'),
			};
		}

		// MEMBER SEARCH
		if (input.search.memberId) {
			match.memberId = shapeIntoMongoObjectId(input.search.memberId);
		}

		console.log('match', match);

		const result = await this.boardArticleModel
			.aggregate([
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
							lookupAuthMemberLiked(memberId),

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
			])
			.exec();

		if (!result.length) {
			throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		}

		return result[0];
	}

	// LIKE TARGET BOARD ARTICLE
	public async likeTargetBoardArticle(memberId: Types.ObjectId, likeRefId: Types.ObjectId): Promise<BoardArticle> {
		const target = await this.boardArticleModel
			.findOne({
				_id: likeRefId,
				articleStatus: BoardArticleStatus.ACTIVE,
			})
			.exec();

		if (!target) {
			throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		}

		const input: LikeInput = {
			memberId: memberId,
			likeRefId: likeRefId,
			likeGroup: LikeGroup.ARTICLE,
		};

		// LIKE TOGGLE +1 / -1
		const modifier: number = await this.likeService.toggleLike(input);

		if (modifier > 0)
			await this.notifications.send(
				target.memberId,
				memberId,
				NotificationType.LIKE,
				NotificationGroup.ARTICLE,
				likeRefId,
				'Your article was liked',
			);
		const result = await this.boardArticleStatusEditor({
			_id: likeRefId,
			targetKey: 'articleLikes',
			modifier: modifier,
		});

		if (!result) {
			throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
		}

		return result;
	}

	// GET ALL BOARD ARTICLES BY ADMIN
	public async getBoardArticlesByAdmin(input: AllBoardArticlesInquiry): Promise<BoardArticles> {
		const { articleStatus, articleCategory } = input.search;

		const match: T = {};

		const sort: T = {
			[input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC,
		};

		// STATUS SEARCH
		if (articleStatus) {
			match.articleStatus = articleStatus;
		}

		// CATEGORY SEARCH
		if (articleCategory) {
			match.articleCategory = articleCategory;
		}

		const result = await this.boardArticleModel
			.aggregate([
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
			])
			.exec();

		if (!result.length) {
			throw new InternalServerErrorException(Message.NO_DATA_FOUND);
		}

		return result[0];
	}

	// UPDATE BOARD ARTICLE BY ADMIN
	public async updateBoardArticleByAdmin(input: BoardArticleUpdate): Promise<BoardArticle> {
		const { _id, articleStatus } = input;

		const articleId = shapeIntoMongoObjectId(_id);

		const result = await this.boardArticleModel
			.findOneAndUpdate(
				{
					_id: articleId,
					articleStatus: BoardArticleStatus.ACTIVE,
				},
				input,
				{
					new: true,
				},
			)
			.exec();

		if (!result) {
			throw new InternalServerErrorException(Message.UPDATE_FAILED);
		}

		if (articleStatus === BoardArticleStatus.DELETE) {
			await this.memberService.memberStatusEditor({
				_id: shapeIntoMongoObjectId(result.memberId),
				targetKey: 'memberArticles',
				modifier: -1,
			});
		}

		return result;
	}

	// REMOVE BOARD ARTICLE BY ADMIN
	public async removeBoardArticleByAdmin(articleId: Types.ObjectId): Promise<BoardArticle> {
		return atomic(this.connection, async (session) => {
			const article = await this.boardArticleModel.findOneAndUpdate(
				{ _id: articleId, articleStatus: BoardArticleStatus.ACTIVE },
				{ $set: { articleStatus: BoardArticleStatus.DELETE } },
				{ new: true, session },
			);
			if (article) {
				await this.memberService.memberStatusEditor(
					{ _id: shapeIntoMongoObjectId(article.memberId), targetKey: 'memberArticles', modifier: -1 },
					session,
				);
				return article;
			}
			const deleted = await this.boardArticleModel
				.findOne({ _id: articleId, articleStatus: BoardArticleStatus.DELETE })
				.session(session);
			if (!deleted) throw new BadRequestException(Message.NO_DATA_FOUND);
			return deleted;
		});
	}

	// BOARD ARTICLE STATUS EDITOR
	public async boardArticleStatusEditor(input: StatisticModifier): Promise<BoardArticle> {
		const { _id, targetKey, modifier } = input;

		const result = await this.boardArticleModel
			.findByIdAndUpdate(
				_id,
				{
					$inc: {
						[targetKey]: modifier,
					},
				},
				{
					new: true,
				},
			)
			.exec();

		if (!result) {
			throw new InternalServerErrorException(Message.UPDATE_FAILED);
		}

		return result;
	}
}
