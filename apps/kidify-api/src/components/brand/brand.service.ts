import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Brand, BrandInput } from './brand';
import { ContentStatus, FAQCategory } from '../../libs/enums/marketplace.enum';
import { PageInquiry, facet, escapeSearch } from '../../libs/marketplace';
@Injectable()
export class BrandService {
	constructor(@InjectModel('Brand') private readonly model: Model<Brand>) {}
	async create(actor: Types.ObjectId, input: BrandInput) {
		return this.model.create({ ...input, createdBy: actor });
	}
	async update(id: Types.ObjectId, input: BrandInput) {
		const result = await this.model.findOneAndUpdate(
			{ _id: id, brandStatus: { $ne: ContentStatus.DELETE } },
			{ $set: input },
			{ new: true, runValidators: true },
		);
		if (!result) throw new NotFoundException('BRAND_NOT_FOUND');
		return result;
	}
	async remove(id: Types.ObjectId) {
		const result = await this.model.findByIdAndUpdate(
			id,
			{ $set: { brandStatus: ContentStatus.DELETE, deletedAt: new Date() } },
			{ new: true },
		);
		if (!result) throw new NotFoundException('BRAND_NOT_FOUND');
		return result;
	}
	async get(id: Types.ObjectId) {
		const result = await this.model.findOne({ _id: id, brandStatus: ContentStatus.ACTIVE });
		if (!result) throw new NotFoundException('BRAND_NOT_FOUND');
		return result;
	}
	async list(input: PageInquiry, text?: string, category?: FAQCategory, admin = false) {
		const match = {
			...(!admin ? { brandStatus: ContentStatus.ACTIVE } : {}),
			...(text ? { brandName: { $regex: escapeSearch(text), $options: 'i' } } : {}),
			...(category ? { category } : {}),
		};
		return (
			await this.model.aggregate([
				{ $match: match },
				{ $sort: { createdAt: input.oldest ? 1 : -1, _id: -1 } },
				facet(input),
			])
		)[0];
	}
}
