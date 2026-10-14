import { Schema, Types } from 'mongoose';
export interface RefreshSession {
  tokenHash: string;
  familyHash: string;
  memberId: Types.ObjectId;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
}
const RefreshSessionSchema = new Schema<RefreshSession>({
  tokenHash: { type: String, required: true, unique: true },
  familyHash: { type: String, required: true, index: true },
  memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });
// Keep spent tokens until their entire family expires so replay remains detectable.
RefreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default RefreshSessionSchema;
