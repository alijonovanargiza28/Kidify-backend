import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import CartSchema from '../../schemas/Cart.model';
import ProductSchema from '../../schemas/Product.model';
import MemberSchema from '../../schemas/Member.model';
import { AuthModule } from '../auth/auth.module';
import { ProductModule } from '../product/product.module';
import { LikeModule } from '../like/like.module';
import { CartService } from './cart.service';
import { CartResolver } from './cart.resolver';
@Module({
	imports: [
		AuthModule,
		ProductModule,
		LikeModule,
		MongooseModule.forFeature([
			{ name: 'Cart', schema: CartSchema },
			{ name: 'Product', schema: ProductSchema },
			{ name: 'Member', schema: MemberSchema },
		]),
	],
	providers: [CartService, CartResolver],
	exports: [CartService],
})
export class CartModule {}
