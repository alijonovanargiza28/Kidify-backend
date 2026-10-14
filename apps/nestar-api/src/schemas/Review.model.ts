import { Schema } from "mongoose";
import { ReviewGroup, ContentStatus } from "../libs/enums/marketplace.enum";
const ReviewSchema = new Schema(
  {
    group: { type: String, enum: ReviewGroup, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    orderId: { type: Schema.Types.ObjectId, required: true },
    authorId: { type: Schema.Types.ObjectId, required: true },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
      validate: Number.isInteger,
    },
    likeCount: { type: Number, default: 0, min: 0 },
    images: { type: [String], default: [] },
    verifiedPurchase: { type: Boolean, default: false },
    replyRole: String,
    adminReply: String,
    replyAuthorId: Schema.Types.ObjectId,
    replyAt: Date,
    text: { type: String, required: true, maxlength: 3000 },
    status: {
      type: String,
      enum: ContentStatus,
      default: ContentStatus.ACTIVE,
    },
  },
  { timestamps: true, collection: "reviews" },
);
ReviewSchema.index({ authorId: 1, group: 1, targetId: 1 }, { unique: true });
ReviewSchema.index({ group: 1, targetId: 1, status: 1, createdAt: -1 });
export default ReviewSchema;
