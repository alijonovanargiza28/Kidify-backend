import { Schema } from 'mongoose';
import { PaymentStatus } from '../libs/enums/marketplace.enum';
const PaymentSchema = new Schema(
	{
		orderId: { type: Schema.Types.ObjectId, required: true, unique: true },
		memberId: { type: Schema.Types.ObjectId, required: true },
		amount: { type: Number, required: true },
		status: { type: String, enum: PaymentStatus, default: PaymentStatus.PENDING },
		paidAt: Date,
	},
	{ timestamps: true, collection: 'payments' },
);
PaymentSchema.index({ memberId: 1, createdAt: -1 });
export default PaymentSchema;
