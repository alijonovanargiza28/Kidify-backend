import { Schema } from 'mongoose';
import { ContentStatus } from '../libs/enums/marketplace.enum';
const BrandSchema = new Schema(
	{
		brandName: { type: String, required: true },
		brandImage: { type: String },
		brandDescription: { type: String },
		brandStatus: { type: String, enum: ContentStatus, default: ContentStatus.ACTIVE },
		createdBy: Schema.Types.ObjectId,
		deletedAt: Date,
	},
	{ timestamps: true, collection: 'brands' },
);
BrandSchema.index({ brandStatus: 1, createdAt: -1 });
export default BrandSchema;
