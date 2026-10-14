import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import OrderSchema from '../../schemas/Order.model';
import CartSchema from '../../schemas/Cart.model';
import ProductSchema from '../../schemas/Product.model';
import AddressSchema from '../../schemas/Address.model';
import PaymentSchema from '../../schemas/Payment.model';
import DeliverySchema from '../../schemas/Delivery.model';
import MemberSchema from '../../schemas/Member.model';
import CouponSchema from '../../schemas/Coupon.model';
import { AuthModule } from '../auth/auth.module';
import { ProductModule } from '../product/product.module';
import { CouponModule } from '../coupon/coupon.module';
import { CartModule } from '../cart/cart.module';
import { OrderService } from './order.service';
import { OrderResolver } from './order.resolver';
@Module({
	imports: [
		AuthModule,
		ProductModule,
		CouponModule,
		CartModule,
		MongooseModule.forFeature([
			{ name: 'Order', schema: OrderSchema },
			{ name: 'Cart', schema: CartSchema },
			{ name: 'Product', schema: ProductSchema },
			{ name: 'Address', schema: AddressSchema },
			{ name: 'Payment', schema: PaymentSchema },
			{ name: 'Delivery', schema: DeliverySchema },
			{ name: 'Member', schema: MemberSchema },
			{ name: 'Coupon', schema: CouponSchema },
		]),
	],
	providers: [OrderService, OrderResolver],
	exports: [OrderService],
})
export class OrderModule {}
