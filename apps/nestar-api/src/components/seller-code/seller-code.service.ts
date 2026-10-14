import { Message } from '../../libs/enums/common.enum';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { SellerCode, SellerCodeInput, SellerCodeStatus } from './seller-code';
import { PageInquiry, facet } from '../../libs/marketplace';
@Injectable()
export class SellerCodeService {
	constructor(@InjectModel('SellerCode') private readonly model: Model<SellerCode>) {}
	async create(actor: Types.ObjectId, input: SellerCodeInput) {
		if (input.expiresAt && input.expiresAt <= new Date()) throw new BadRequestException(Message.SELLER_CODE_EXPIRED);
		const code = input.code?.trim();
        if (code !== undefined && (code.length < 8 || code.length > 128)) throw new BadRequestException('SELLER_CODE_LENGTH');
        try { return await this.model.create({
			code: code ?? randomBytes(18).toString('hex'),
			expiresAt: input.expiresAt,
			createdBy: actor,
		}); } catch (error) { if (error?.code === 11000) throw new BadRequestException('SELLER_CODE_ALREADY_EXISTS'); throw error; }
	}
	async list(input: PageInquiry) {
		await this.model.updateMany(
			{ status: SellerCodeStatus.ACTIVE, expiresAt: { $lte: new Date() } },
			{ $set: { status: SellerCodeStatus.EXPIRED } },
		);
		return (await this.model.aggregate([{ $sort: { createdAt: -1 } }, facet(input)]))[0];
	}
	async revoke(id: Types.ObjectId) {
		const code = await this.model.findOneAndUpdate(
			{ _id: id, status: SellerCodeStatus.ACTIVE },
			{ $set: { status: SellerCodeStatus.REVOKED } },
			{ new: true },
		);
		if (!code) throw new NotFoundException('ACTIVE_SELLER_CODE_NOT_FOUND');
		return code;
	}
	async consume(code: string, memberId: Types.ObjectId, session: ClientSession) {
		const found = await this.model.findOne({ code }).session(session);
		if (!found) throw new BadRequestException(Message.INVALID_SELLER_CODE);
		if (found.status !== SellerCodeStatus.ACTIVE) throw new BadRequestException(`SELLER_CODE_${found.status}`);
		if (found.expiresAt && found.expiresAt <= new Date()) throw new BadRequestException(Message.SELLER_CODE_EXPIRED);
		const used = await this.model.findOneAndUpdate(
			{ _id: found._id, status: SellerCodeStatus.ACTIVE },
			{
				$set: { status: SellerCodeStatus.USED, usedBy: memberId, usedAt: new Date() },
			},
			{ new: true, session },
		);
		if (!used) throw new BadRequestException(Message.SELLER_CODE_USED);
	}
}
