import { Schema } from 'mongoose';
import { OrderStatus, PaymentStatus } from '../libs/enums/marketplace.enum';
const item = new Schema({
	productId: { type: Schema.Types.ObjectId, required: true },
	sellerId: { type: Schema.Types.ObjectId, required: true },
	productName: String,
	productImage: String,
	variantId: { type: Schema.Types.ObjectId, required: true },
	color: String,
	size: String,
	quantity: { type: Number, min: 1 },
	unitPrice: Number,
	discount: Number,
	finalUnitPrice: Number,
	finalItemPrice: Number,
	status: { type: String, enum: OrderStatus, default: OrderStatus.PENDING },
});
const OrderSchema = new Schema(
	{
		memberId: { type: Schema.Types.ObjectId, required: true },
		requestId: { type: String, required: true },
		items: { type: [item], required: true },
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
		subtotal: Number,
		productDiscount: Number,
		couponDiscount: Number,
		deliveryFee: Number,
		total: Number,
		status: { type: String, enum: OrderStatus, default: OrderStatus.PENDING },
		paymentStatus: { type: String, enum: PaymentStatus, default: PaymentStatus.PENDING },
		paymentId: { type: Schema.Types.ObjectId, required: true },
		deliveryId: { type: Schema.Types.ObjectId, required: true },
		couponId: Schema.Types.ObjectId,
	},
	{ timestamps: true, collection: 'orders' },
);
OrderSchema.index({ memberId: 1, requestId: 1 }, { unique: true });
OrderSchema.index({ memberId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ 'items.sellerId': 1, createdAt: -1 });
export default OrderSchema;
