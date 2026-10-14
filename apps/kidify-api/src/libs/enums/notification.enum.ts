import { registerEnumType } from '@nestjs/graphql';
export enum NotificationType {
	LIKE = 'LIKE',
	COMMENT = 'COMMENT',
	FOLLOW = 'FOLLOW',
	ORDER = 'ORDER',
	DELIVERY = 'DELIVERY',
	EVENT = 'EVENT',
	MESSAGE = 'MESSAGE',
	SYSTEM = 'SYSTEM',
}
registerEnumType(NotificationType, { name: 'NotificationType' });
export enum NotificationStatus {
	WAIT = 'WAIT',
	READ = 'READ',
}
registerEnumType(NotificationStatus, { name: 'NotificationStatus' });
export enum NotificationGroup {
	PRODUCT = 'PRODUCT',
	ARTICLE = 'ARTICLE',
	MEMBER = 'MEMBER',
	ORDER = 'ORDER',
	EVENT = 'EVENT',
	MESSAGE = 'MESSAGE',
}
registerEnumType(NotificationGroup, { name: 'NotificationGroup' });
