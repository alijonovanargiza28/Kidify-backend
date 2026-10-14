import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType } from '../../libs/enums/member.enum';
import { Resolver, Args, Mutation, Query, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Notification, Notifications, NotificationsInquiry } from './notification';
import { NotificationService } from './notification.service';
import { shapeIntoMongoObjectId } from '../../libs/config';
@Resolver()
@UseGuards(AuthGuard)
export class NotificationResolver {
	constructor(private readonly service: NotificationService) {}
	@Query(() => Notifications) getMyNotifications(
		@Args('input') input: NotificationsInquiry,
		@AuthMember('_id') memberId: Types.ObjectId,
	) {
		return this.service.list(memberId, input);
	}
	@Query(() => Int) getUnreadNotificationCount(@AuthMember('_id') memberId: Types.ObjectId) {
		return this.service.count(memberId);
	}
	@Mutation(() => Notification) markNotificationRead(
		@Args('notificationId') id: string,
		@AuthMember('_id') memberId: Types.ObjectId,
	) {
		return this.service.read(memberId, shapeIntoMongoObjectId(id));
	}
	@Mutation(() => Boolean) markAllNotificationsRead(@AuthMember('_id') memberId: Types.ObjectId) {
		return this.service.readAll(memberId);
	}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Boolean)
	createSystemAnnouncement(@Args('title') title: string, @AuthMember('_id') actorId: Types.ObjectId) {
		return this.service.announce(actorId, title);
	}
}
