import { Schema } from 'mongoose';
import { OrderStatus } from '../libs/enums/marketplace.enum';
const DeliverySchema = new Schema(
	{
		orderId: { type: Schema.Types.ObjectId, required: true, unique: true },
		status: { type: String, enum: OrderStatus, default: OrderStatus.PENDING },
		shippingAddress: {
			recipientName: String,
			phone: String,
			region: String,
			city: String,
			district: String,
			street: String,
			postalCode: String,
			instructions: String,
		},
		trackingCode: String,
		shippedAt: Date,
		deliveredAt: Date,
	},
	{ timestamps: true, collection: 'deliveries' },
);
DeliverySchema.index({ status: 1, createdAt: -1 });
export default DeliverySchema;
