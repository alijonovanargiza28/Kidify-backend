import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Like, MeLiked } from '../../libs/dto/like/like';
import { ClientSession, Model } from 'mongoose';
import { LikeInput } from '../../libs/dto/like/like.input';
import { Message } from '../../libs/enums/common.enum';
import { T } from '../../libs/types/common';

@Injectable()
export class LikeService {
	constructor(
		@InjectModel('like')
		private readonly likeModel: Model<Like>,
	) {}

	public async toggleLike(input: LikeInput, session?: ClientSession): Promise<number> {
		const search: T = {
			likeGroup: input.likeGroup,
			memberId: input.memberId,
			likeRefId: input.likeRefId,
		};

		const exist = await this.likeModel
			.findOne(search)
			.session(session ?? null)
			.exec();

		let modifier = 1;

		if (exist) {
			const removed = await this.likeModel.findByIdAndDelete(exist._id, { session }).exec();
			modifier = removed ? -1 : 0;
		} else {
			try {
				await this.likeModel.create([input], { session });
			} catch (err) {
				if ((err as { code?: number }).code === 11000 && !session) return 0;
				console.log('Error, Service.model:', err instanceof Error ? err.message : err);

				throw new BadRequestException(Message.CREATE_FAILED);
			}
		}

		console.log(`-Like modifier ${modifier}-`);

		return modifier;
	}

	public async checkLikeExistence(input: LikeInput): Promise<MeLiked[]> {
		const { memberId, likeRefId, likeGroup } = input;

		const result = await this.likeModel
			.findOne({
				memberId: memberId,
				likeRefId: likeRefId,
				likeGroup,
			})
			.exec();

		return result
			? [
					{
						memberId: memberId,
						likeRefId: likeRefId,
						myFavorite: true,
					},
				]
			: [];
	}

	async removeLike(input: LikeInput): Promise<boolean> {
		const result = await this.likeModel.deleteOne(input);
		return result.deletedCount === 1;
	}
}
