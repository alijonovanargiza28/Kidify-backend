import { Schema } from "mongoose";
export const ChatStateSchema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, required: true, unique: true },
    globalReadAt: Date,
    mutedUntil: Date,
    blocked: { type: Boolean, default: false },
    moderatedBy: Schema.Types.ObjectId,
  },
  { timestamps: true, collection: "chat_states" },
);
export const ChatQuotaSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    expiresAt: Date,
  },
  { collection: "chat_quotas" },
);
ChatQuotaSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
