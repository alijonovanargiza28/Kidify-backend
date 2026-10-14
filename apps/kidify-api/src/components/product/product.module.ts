import OrderSchema from '../../schemas/Order.model';
import { ProductActivityService, ProductActivityResolver } from './product-activity.resolver';
import LikeSchema from '../../schemas/Like.model';
import ViewSchema from '../../schemas/View.model';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import ProductSchema from '../../schemas/Product.model';
import MemberSchema from '../../schemas/Member.model';
import BrandSchema from '../../schemas/Brand.model';
import { AuthModule } from '../auth/auth.module';
import { LikeModule } from '../like/like.module';
import { ViewModule } from '../view/view.module';
import { ProductService } from './product.service';
import { ProductResolver } from './product.resolver';
@Module({
	imports: [
		AuthModule,
		LikeModule,
		ViewModule,
		MongooseModule.forFeature([
			{ name: 'Order', schema: OrderSchema },
			{ name: 'like', schema: LikeSchema },
			{ name: 'View', schema: ViewSchema },
			{ name: 'Product', schema: ProductSchema },
			{ name: 'Member', schema: MemberSchema },
			{ name: 'Brand', schema: BrandSchema },
		]),
	],
	providers: [ProductService, ProductResolver, ProductActivityService, ProductActivityResolver],
	exports: [ProductService],
})
export class ProductModule {}
