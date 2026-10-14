import { registerEnumType } from '@nestjs/graphql';
export enum ContentStatus {
	ACTIVE = 'ACTIVE',
	PAUSE = 'PAUSE',
	DELETE = 'DELETE',
}
registerEnumType(ContentStatus, { name: 'ContentStatus' });
export enum DiscountType {
	PERCENT = 'PERCENT',
	FIXED = 'FIXED',
}
registerEnumType(DiscountType, { name: 'DiscountType' });
export enum CouponStatus {
	ACTIVE = 'ACTIVE',
	DISABLED = 'DISABLED',
}
registerEnumType(CouponStatus, { name: 'CouponStatus' });
export enum OrderStatus {
	PENDING = 'PENDING',
	CONFIRMED = 'CONFIRMED',
	PREPARING = 'PREPARING',
	READY_FOR_DELIVERY = 'READY_FOR_DELIVERY',
	SHIPPED = 'SHIPPED',
	DELIVERED = 'DELIVERED',
	CANCELLED = 'CANCELLED',
	REFUNDED = 'REFUNDED',
}
registerEnumType(OrderStatus, { name: 'OrderStatus' });
export enum PaymentStatus {
	PENDING = 'PENDING',
	PAID = 'PAID',
	FAILED = 'FAILED',
	REFUNDED = 'REFUNDED',
	CANCELLED = 'CANCELLED',
}
registerEnumType(PaymentStatus, { name: 'PaymentStatus' });
export enum ReviewGroup {
	PRODUCT = 'PRODUCT',
	SELLER = 'SELLER',
}
registerEnumType(ReviewGroup, { name: 'ReviewGroup' });
export enum EventType {
	NEWBORN = 'NEWBORN',
	MONTHLY_PHOTO = 'MONTHLY_PHOTO',
	BABY_100_DAYS = 'BABY_100_DAYS',
	FIRST_BIRTHDAY = 'FIRST_BIRTHDAY',
	BIRTHDAY = 'BIRTHDAY',
	BABY_SHOWER = 'BABY_SHOWER',
	HOLIDAY = 'HOLIDAY',
	SALE = 'SALE',
}
registerEnumType(EventType, { name: 'EventType' });
export enum FAQCategory {
	ORDER = 'ORDER',
	PAYMENT = 'PAYMENT',
	DELIVERY = 'DELIVERY',
	RETURN_EXCHANGE = 'RETURN_EXCHANGE',
	PRODUCT = 'PRODUCT',
	SELLER = 'SELLER',
	ACCOUNT = 'ACCOUNT',
	OTHER = 'OTHER',
}
registerEnumType(FAQCategory, { name: 'FAQCategory' });
export enum SupportStatus {
	OPEN = 'OPEN',
	IN_PROGRESS = 'IN_PROGRESS',
	RESOLVED = 'RESOLVED',
	CLOSED = 'CLOSED',
}
registerEnumType(SupportStatus, { name: 'SupportStatus' });
export enum NotificationFilter {
	ALL = 'ALL',
	UNREAD = 'UNREAD',
	READ = 'READ',
}
registerEnumType(NotificationFilter, { name: 'NotificationFilter' });
