import { Schema } from 'mongoose';
import { DiscountType, CouponStatus } from '../libs/enums/marketplace.enum';
const CouponSchema = new Schema(
	{
		code: { type: String, required: true, unique: true },
		discountType: { type: String, enum: DiscountType, required: true },
		discountValue: { type: Number, required: true, min: 0 },
		minimumOrder: { type: Number, min: 0 },
		maximumDiscount: { type: Number, min: 0 },
		usageLimit: { type: Number, min: 1 },
		usedCount: { type: Number, default: 0 },
		startAt: Date,
		endAt: Date,
		status: { type: String, enum: CouponStatus, default: CouponStatus.ACTIVE },
		createdBy: { type: Schema.Types.ObjectId, required: true },
	},
	{ timestamps: true, collection: 'coupons' },
);
export default CouponSchema;
