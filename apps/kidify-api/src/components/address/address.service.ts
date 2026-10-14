import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import { Address, AddressInput } from './address';
import { atomic } from '../../libs/marketplace';
@Injectable()
export class AddressService {
	constructor(
		@InjectModel('Address') private readonly model: Model<Address>,
		@InjectConnection() private readonly connection: Connection,
	) {}
	list(memberId: Types.ObjectId) {
		return this.model.find({ memberId }).sort({ isDefault: -1, createdAt: -1 }).limit(100);
	}
	async create(memberId: Types.ObjectId, input: AddressInput) {
		return atomic(this.connection, async (session) => {
			if ((await this.model.countDocuments({ memberId }).session(session)) >= 100)
				throw new BadRequestException('ADDRESS_LIMIT');
			if (input.isDefault)
				await this.model.updateMany({ memberId, isDefault: true }, { $set: { isDefault: false } }, { session });
			return (await this.model.create([{ ...input, memberId }], { session }))[0];
		});
	}
	async update(memberId: Types.ObjectId, id: Types.ObjectId, input: AddressInput) {
		return atomic(this.connection, async (session) => {
			if (input.isDefault)
				await this.model.updateMany({ memberId, isDefault: true }, { $set: { isDefault: false } }, { session });
			const result = await this.model.findOneAndUpdate(
				{ _id: id, memberId },
				{ $set: input },
				{ new: true, runValidators: true, session },
			);
			if (!result) throw new NotFoundException('ADDRESS_NOT_FOUND');
			return result;
		});
	}
	async remove(memberId: Types.ObjectId, id: Types.ObjectId) {
		const result = await this.model.deleteOne({ _id: id, memberId });
		if (!result.deletedCount) throw new NotFoundException('ADDRESS_NOT_FOUND');
		return true;
	}
	async setDefault(memberId: Types.ObjectId, id: Types.ObjectId) {
		return atomic(this.connection, async (session) => {
			await this.model.updateMany({ memberId, isDefault: true }, { $set: { isDefault: false } }, { session });
			const result = await this.model.findOneAndUpdate(
				{ _id: id, memberId },
				{ $set: { isDefault: true } },
				{ new: true, session },
			);
			if (!result) throw new NotFoundException('ADDRESS_NOT_FOUND');
			return result;
		});
	}
}
