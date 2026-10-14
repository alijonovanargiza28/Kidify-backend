import { Schema } from 'mongoose';
const MessageSchema = new Schema(
	{
		senderId: { type: Schema.Types.ObjectId, required: true },
		receiverId: { type: Schema.Types.ObjectId },
		productId: Schema.Types.ObjectId,
        scope: { type: String, enum: ['PRIVATE', 'GLOBAL'], default: 'PRIVATE' },
        clientMessageId: String,
        deletedAt: Date,
		text: { type: String, required: true, maxlength: 3000 },
		isRead: { type: Boolean, default: false },
	},
	{ timestamps: true, collection: 'messages' },
);
MessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
MessageSchema.index({ receiverId: 1, isRead: 1, createdAt: -1 });
MessageSchema.index({ scope: 1, _id: -1 });
MessageSchema.index({ senderId: 1, clientMessageId: 1 }, { unique: true, partialFilterExpression: { clientMessageId: { $type: 'string' } } });
export default MessageSchema;
