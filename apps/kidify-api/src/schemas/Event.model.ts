import { Schema } from 'mongoose';
import { ContentStatus, EventType } from '../libs/enums/marketplace.enum';
const EventSchema = new Schema(
	{
		title: { type: String, required: true },
		description: { type: String, required: true },
		images: { type: [String], required: true },
		eventType: { type: String, required: true, enum: EventType },
		startAt: { type: Date, required: true },
		endAt: { type: Date, required: true },
		status: { type: String, enum: ContentStatus, default: ContentStatus.ACTIVE },
		createdBy: Schema.Types.ObjectId,
		deletedAt: Date,
	},
	{ timestamps: true, collection: 'events' },
);
EventSchema.index({ status: 1, createdAt: -1 });
export default EventSchema;
