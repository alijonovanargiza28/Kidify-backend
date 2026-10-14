import { Field, ObjectType, InputType } from '@nestjs/graphql';
import { IsOptional } from 'class-validator';

import { TotalCounter } from '../../libs/dto/member/member';
import { NotificationType, NotificationStatus, NotificationGroup } from '../../libs/enums/notification.enum';
import { NotificationFilter } from '../../libs/enums/marketplace.enum';
import { PageInquiry } from '../../libs/marketplace';
@ObjectType()
export class Notification {
	@Field(() => String) _id!: string;
	@Field(() => NotificationType) notificationType!: NotificationType;
	@Field(() => NotificationStatus) notificationStatus!: NotificationStatus;
	@Field(() => NotificationGroup) notificationGroup!: NotificationGroup;
	@Field(() => String) notificationTitle!: string;
	@Field(() => String, { nullable: true }) notificationDesc?: string;
	@Field(() => String) authorId!: string;
	@Field(() => String) receiverId!: string;
	@Field(() => String, { nullable: true }) targetId?: string;
	@Field(() => Date) createdAt!: Date;
}
@ObjectType()
export class Notifications {
	@Field(() => [Notification]) list!: Notification[];
	@Field(() => [TotalCounter]) metaCounter!: TotalCounter[];
}

@InputType()
export class NotificationsInquiry extends PageInquiry {
	@IsOptional() @Field(() => NotificationFilter, { defaultValue: NotificationFilter.ALL }) filter: NotificationFilter =
		NotificationFilter.ALL;
}
