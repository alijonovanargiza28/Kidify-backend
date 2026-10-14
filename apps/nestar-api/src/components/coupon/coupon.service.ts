import { Message } from '../../libs/enums/common.enum';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Coupon, CouponInput } from './coupon';
import { CouponStatus, DiscountType } from '../../libs/enums/marketplace.enum';
import { PageInquiry, facet, money } from '../../libs/marketplace';
export function couponDiscount(coupon: Coupon, subtotal: number, now = new Date()) {
	if (
		coupon.status !== CouponStatus.ACTIVE ||
		(coupon.startAt && coupon.startAt > now) ||
		(coupon.endAt && coupon.endAt <= now) ||
		(coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) ||
		subtotal < (coupon.minimumOrder ?? 0)
	)
		throw new BadRequestException(Message.INVALID_COUPON);
	const amount =
		coupon.discountType === DiscountType.PERCENT ? (subtotal * coupon.discountValue) / 100 : coupon.discountValue;
	return money(Math.max(0, Math.min(subtotal, amount, coupon.maximumDiscount ?? Infinity)));
}
@Injectable()
export class CouponService {
	constructor(@InjectModel('Coupon') private readonly model: Model<Coupon>) {}
	validate(input: CouponInput) {
        if (!input.code?.trim() || input.code.trim().length > 80) throw new BadRequestException('INVALID_COUPON_CODE');
		if (input.discountType === DiscountType.PERCENT && input.discountValue > 100)
			throw new BadRequestException(Message.INVALID_COUPON);
		if (input.startAt && input.endAt && input.startAt >= input.endAt)
			throw new BadRequestException(Message.INVALID_COUPON);
	}
	async create(actor: Types.ObjectId, input: CouponInput) {
		this.validate(input);
		try { return await this.model.create({ ...input, code: input.code.trim().toUpperCase(), createdBy: actor }); }
        catch (error) { if (error?.code === 11000) throw new BadRequestException('COUPON_CODE_ALREADY_EXISTS'); throw error; }
	}
	async update(id: Types.ObjectId, input: CouponInput) {
		this.validate(input);
		let result;
        try { result = await this.model.findByIdAndUpdate(
			id,
			{ $set: { ...input, code: input.code.trim().toUpperCase() } },
			{ new: true, runValidators: true },
		); } catch (error) { if (error?.code === 11000) throw new BadRequestException('COUPON_CODE_ALREADY_EXISTS'); throw error; }
		if (!result) throw new NotFoundException('COUPON_NOT_FOUND');
		return result;
	}
	async disable(id: Types.ObjectId) {
		const result = await this.model.findByIdAndUpdate(id, { $set: { status: CouponStatus.DISABLED } }, { new: true });
		if (!result) throw new NotFoundException('COUPON_NOT_FOUND');
		return result;
	}
	async list(input: PageInquiry) {
		return (await this.model.aggregate([{ $sort: { createdAt: -1 } }, facet(input)]))[0];
	}
	async apply(code: string, subtotal: number, session?: ClientSession) {
		const coupon = await this.model
			.findOne({ code: code.trim().toUpperCase() })
			.session(session ?? null)
			.lean();
		if (!coupon) throw new BadRequestException(Message.INVALID_COUPON);
		const discount = couponDiscount(coupon, subtotal);
		if (session) {
			const result = await this.model.updateOne(
				{
					_id: coupon._id,
					status: CouponStatus.ACTIVE,
					...(coupon.usageLimit != null ? { usedCount: { $lt: coupon.usageLimit } } : {}),
				},
				{ $inc: { usedCount: 1 } },
				{ session },
			);
			if (!result.modifiedCount) throw new BadRequestException(Message.INVALID_COUPON);
		}
		return { coupon, discount, total: money(subtotal - discount) };
	}
}
