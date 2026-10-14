import { RefreshSession } from './refresh-session.model';
import { Message } from '../../libs/enums/common.enum';
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MemberStatus } from '../../libs/enums/member.enum';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Member } from '../../libs/dto/member/member';
import { T } from '../../libs/types/common';
import { shapeIntoMongoObjectId } from '../../libs/config';

@Injectable()
export class AuthService {
	constructor(
		private jwtService: JwtService,
		@InjectModel('Member') private readonly memberModel: Model<Member>,
        @InjectModel('RefreshSession') private readonly sessions: Model<RefreshSession>,
	) {}

	public async hashPassword(memberPassword: string): Promise<string> {
		const salt = await bcrypt.genSalt();
		return await bcrypt.hash(memberPassword, salt);
	}

	public async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
		return await bcrypt.compare(password, hashedPassword);
	}

	public async createToken(member: Member, sessionHash?: string): Promise<string> {
		return this.jwtService.signAsync({ sub: String(member._id), _id: String(member._id), ...(sessionHash ? { sid: sessionHash } : {}) }, { expiresIn: '15m' });
	}
	public async verifyToken(token: string): Promise<Member> {
		let payload: { sub?: string; _id?: string; sid?: string; iat?: number; exp?: number };
		try {
			payload = await this.jwtService.verifyAsync(token);
		} catch {
			throw new UnauthorizedException(Message.UNAUTHORIZED);
		}
        if (!payload.exp || !payload.iat || payload.exp - payload.iat > 900) throw new UnauthorizedException(Message.UNAUTHORIZED);
        if (payload.sid && !(await this.sessions.exists({ familyHash: payload.sid, usedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } }))) throw new UnauthorizedException(Message.UNAUTHORIZED);
		let memberId;
		try {
			memberId = shapeIntoMongoObjectId(payload.sub ?? payload._id ?? '');
		} catch {
			throw new UnauthorizedException(Message.UNAUTHORIZED);
		}
		const member = await this.memberModel.findById(memberId).lean();
		if (!member || member.memberStatus === MemberStatus.DELETE) throw new UnauthorizedException(Message.UNAUTHORIZED);
		if (member.memberStatus === MemberStatus.BLOCK) throw new ForbiddenException(Message.BLOCKED_MEMBER);
		return member;
	}
}
