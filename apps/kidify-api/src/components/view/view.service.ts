import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { View } from '../../libs/dto/view/view';
import { ViewInput } from '../../libs/dto/view/view.input';

@Injectable()
export class ViewService {
	constructor(@InjectModel('View') private readonly viewModel: Model<View>) {}

	public async recordView(input: ViewInput): Promise<View | null> {
		const filter = { memberId: input.memberId, viewRefId: input.viewRefId, viewGroup: input.viewGroup };
		try {
			const existing = await this.viewModel.findOneAndUpdate(filter, { $set: { updatedAt: new Date() } });
			if (existing) return null;
			return await this.viewModel.create(input);
		} catch (error) {
			if ((error as { code?: number }).code === 11000) return null;
			throw error;
		}
	}

	// memberId→ qaysi member mahsulotni ko‘rganini aniqlaymiz.
}
