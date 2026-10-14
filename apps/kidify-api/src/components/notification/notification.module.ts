import MemberSchema from '../../schemas/Member.model';
import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import NotificationSchema from '../../schemas/Notification.model';
import { NotificationService } from './notification.service';
import { NotificationResolver } from './notification.resolver';
@Global()
@Module({
	imports: [
		AuthModule,
		MongooseModule.forFeature([
			{ name: 'Member', schema: MemberSchema },
			{ name: 'Notification', schema: NotificationSchema },
		]),
	],
	providers: [NotificationService, NotificationResolver],
	exports: [NotificationService],
})
export class NotificationModule {}
