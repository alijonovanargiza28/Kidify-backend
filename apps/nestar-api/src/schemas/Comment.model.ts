import { Schema } from 'mongoose';
import { CommentGroup, CommentStatus } from '../libs/enums/comment.enum';

const CommentSchema = new Schema(
	{
        likeCount: { type: Number, default: 0, min: 0 },
        verifiedPurchase: { type: Boolean, default: false },
        replyText: String,
        replyAuthorId: Schema.Types.ObjectId,
		commentStatus: {
			type: String,
			enum: CommentStatus,
			default: CommentStatus.ACTIVE,
		},

		commentGroup: {
			type: String,
			enum: CommentGroup,
			required: true,
		},

		commentContent: {
			type: String,
			required: true,
		},

		commentRefId: {
			type: Schema.Types.ObjectId,
			required: true,
		},

		memberId: {
			type: Schema.Types.ObjectId,
			required: true,
		},
	},
	{ timestamps: true, collection: 'comments' },
);

CommentSchema.index({ commentRefId: 1, commentStatus: 1, createdAt: -1 });
export default CommentSchema;
