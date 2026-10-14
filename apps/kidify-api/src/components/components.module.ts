import { DashboardModule } from './dashboard/dashboard.module';
import { CouponModule } from './coupon/coupon.module';
import { AddressModule } from './address/address.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { DeliveryModule } from './delivery/delivery.module';
import { ReviewModule } from './review/review.module';
import { MessageModule } from './message/message.module';
import { EventModule } from './event/event.module';
import { FAQModule } from './faq/faq.module';
import { SupportModule } from './support/support.module';
import { SellerCodeModule } from './seller-code/seller-code.module';
import { ProductModule } from './product/product.module';
import { BrandModule } from './brand/brand.module';
import { NotificationModule } from './notification/notification.module';
import { CartModule } from './cart/cart.module';
import { Module } from '@nestjs/common';
import { MemberModule } from './member/member.module';
import { AuthModule } from './auth/auth.module';
import { CommentModule } from './comment/comment.module';
import { LikeModule } from './like/like.module';
import { ViewModule } from './view/view.module';
import { FollowModule } from './follow/follow.module';
import { BoardArticleModule } from './board-article/board-article.module';

@Module({
	imports: [
		CouponModule,
		AddressModule,
		OrderModule,
		PaymentModule,
		DeliveryModule,
		ReviewModule,
		MessageModule,
		EventModule,
		FAQModule,
		SupportModule,
		DashboardModule,
		MemberModule,
		SellerCodeModule,
		ProductModule,
		BrandModule,
		NotificationModule,
		CartModule,

		BoardArticleModule,
		AuthModule,
		LikeModule,
		ViewModule,
		CommentModule,
		FollowModule,
	],
})
export class ComponentsModule {}
