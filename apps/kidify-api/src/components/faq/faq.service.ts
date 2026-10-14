import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FAQ, FAQInput } from './faq';
import { ContentStatus, FAQCategory } from '../../libs/enums/marketplace.enum';
import { PageInquiry, facet, escapeSearch } from '../../libs/marketplace';
@Injectable()
export class FAQService {
	constructor(@InjectModel('FAQ') private readonly model: Model<FAQ>) {}
	async create(actor: Types.ObjectId, input: FAQInput) {
		return this.model.create({ ...input, createdBy: actor });
	}
	async update(id: Types.ObjectId, input: FAQInput) {
		const result = await this.model.findOneAndUpdate(
			{ _id: id, status: { $ne: ContentStatus.DELETE } },
			{ $set: input },
			{ new: true, runValidators: true },
		);
		if (!result) throw new NotFoundException('FAQ_NOT_FOUND');
		return result;
	}
	async remove(id: Types.ObjectId) {
		const result = await this.model.findByIdAndUpdate(
			id,
			{ $set: { status: ContentStatus.DELETE, deletedAt: new Date() } },
			{ new: true },
		);
		if (!result) throw new NotFoundException('FAQ_NOT_FOUND');
		return result;
	}
	async get(id: Types.ObjectId) {
		const result = await this.model.findOne({ _id: id, status: ContentStatus.ACTIVE });
		if (!result) throw new NotFoundException('FAQ_NOT_FOUND');
		return result;
	}
	async list(input: PageInquiry, text?: string, category?: FAQCategory, admin = false) {
		const match = {
			...(!admin ? { status: ContentStatus.ACTIVE } : {}),
			...(text ? { question: { $regex: escapeSearch(text), $options: 'i' } } : {}),
			...(category ? { category } : {}),
		};
		return (
			await this.model.aggregate([
				{ $match: match },
				{ $sort: { sortOrder: 1, createdAt: input.oldest ? 1 : -1, _id: -1 } },
				facet(input),
			])
		)[0];
	}
}
