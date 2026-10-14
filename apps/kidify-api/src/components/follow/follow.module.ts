import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import MemberSchema from '../../schemas/Member.model';
import { AuthModule } from '../auth/auth.module';


import { FollowResolver } from './follow.resolver';
import { FollowService } from './follow.service';
import FollowSchema from '../../schemas/Follow.model';
import { MemberModule } from '../member/member.module';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'Follow', schema: FollowSchema },
			{ name: 'Member', schema: MemberSchema },
		]),
		AuthModule,
		MemberModule,
	],
	providers: [FollowResolver, FollowService],
	exports: [FollowService],
})
export class FollowModule {}
