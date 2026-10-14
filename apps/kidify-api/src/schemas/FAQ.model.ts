import { Schema } from 'mongoose';
import { ContentStatus, FAQCategory } from '../libs/enums/marketplace.enum';
const FAQSchema = new Schema(
	{
		question: { type: String, required: true },
		answer: { type: String, required: true },
		category: { type: String, required: true, enum: FAQCategory },
		sortOrder: { type: Number, default: 0 },
		status: { type: String, enum: ContentStatus, default: ContentStatus.ACTIVE },
		createdBy: Schema.Types.ObjectId,
		deletedAt: Date,
	},
	{ timestamps: true, collection: 'faqs' },
);
FAQSchema.index({ status: 1, createdAt: -1 });
export default FAQSchema;
