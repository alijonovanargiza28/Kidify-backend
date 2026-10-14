import { Schema } from 'mongoose';
import { SupportStatus, FAQCategory } from '../libs/enums/marketplace.enum';
const SupportSchema = new Schema(
	{
		creatorId: { type: Schema.Types.ObjectId, required: true },
		subject: { type: String, required: true, maxlength: 150 },
		message: { type: String, required: true, maxlength: 5000 },
		category: { type: String, enum: FAQCategory, required: true },
		relatedOrderId: Schema.Types.ObjectId,
		status: { type: String, enum: SupportStatus, default: SupportStatus.OPEN },
		assignedCS: Schema.Types.ObjectId,
		replies: [
			new Schema({
				authorId: { type: Schema.Types.ObjectId, required: true },
				text: { type: String, required: true, maxlength: 5000 },
				createdAt: { type: Date, default: Date.now },
			}),
		],
	},
	{ timestamps: true, collection: 'supportTickets' },
);
SupportSchema.index({ creatorId: 1, status: 1, createdAt: -1 });
SupportSchema.index({ assignedCS: 1, status: 1, createdAt: -1 });
export default SupportSchema;
