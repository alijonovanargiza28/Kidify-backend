import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { createHash, randomBytes } from 'crypto';
import { RefreshSession } from './refresh-session.model';
import { AuthService } from './auth.service';
import { Member } from '../../libs/dto/member/member';
import { atomic } from '../../libs/marketplace';
export const refreshHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const REFRESH_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
@Injectable()
export class RefreshSessionService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel('RefreshSession') private readonly sessions: Model<RefreshSession>,
    @InjectModel('Member') private readonly members: Model<Member>,
    private readonly auth: AuthService,
  ) {}
  async issue(member: Member) {
    const token = randomBytes(32).toString('hex');
    const familyHash = refreshHash(randomBytes(32).toString('hex'));
    const expiresAt = new Date(Date.now() + REFRESH_LIFETIME_MS);
    await this.sessions.create({ tokenHash: refreshHash(token), familyHash, memberId: member._id, expiresAt });
    return { token, expiresAt, accessToken: await this.auth.createToken(member, familyHash) };
  }
  async rotate(token?: string) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new UnauthorizedException('UNAUTHORIZED');
    const result = await atomic(this.connection, async session => {
      const now = new Date();
      const previous = await this.sessions.findOne({ tokenHash: refreshHash(token) }).session(session);
      if (!previous) return null;
      if (previous.usedAt || previous.revokedAt || previous.expiresAt <= now) {
        await this.sessions.updateMany({ familyHash: previous.familyHash, revokedAt: null }, { $set: { revokedAt: now } }, { session });
        return null; // Commit revocation before rejecting outside the transaction.
      }
      const member = await this.members.findById(previous.memberId).session(session);
      if (!member || member.memberStatus !== 'ACTIVE') {
        await this.sessions.updateMany({ familyHash: previous.familyHash }, { $set: { revokedAt: now } }, { session });
        return null;
      }
      const claimed = await this.sessions.updateOne({ _id: previous._id, usedAt: null, revokedAt: null }, { $set: { usedAt: now } }, { session });
      if (claimed.modifiedCount !== 1) {
        await this.sessions.updateMany({ familyHash: previous.familyHash }, { $set: { revokedAt: now } }, { session });
        return null;
      }
      const next = randomBytes(32).toString('hex');
      await this.sessions.create([{ tokenHash: refreshHash(next), familyHash: previous.familyHash, memberId: previous.memberId, expiresAt: previous.expiresAt }], { session });
      return { token: next, expiresAt: previous.expiresAt, accessToken: await this.auth.createToken(member, previous.familyHash) };
    });
    if (!result) throw new UnauthorizedException('UNAUTHORIZED');
    return result;
  }
  async revoke(token?: string) {
    if (!token) return;
    await atomic(this.connection, async session => {
      const record = await this.sessions.findOne({ tokenHash: refreshHash(token) }).session(session);
      if (record) await this.sessions.updateMany({ familyHash: record.familyHash, revokedAt: null }, { $set: { revokedAt: new Date() } }, { session });
      return true;
    });
  }
}
