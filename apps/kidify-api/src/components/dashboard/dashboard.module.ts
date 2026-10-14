import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { MemberModule } from '../member/member.module';
import MemberSchema from '../../schemas/Member.model';
import ProductSchema from '../../schemas/Product.model';
import OrderSchema from '../../schemas/Order.model';
import { DashboardService } from './dashboard.service';
import { DashboardResolver } from './dashboard.resolver';
@Module({
	imports: [
		AuthModule,
		MemberModule,
		MongooseModule.forFeature([
			{ name: 'Product', schema: ProductSchema },
			{ name: 'Member', schema: MemberSchema },
			{ name: 'Order', schema: OrderSchema },
		]),
	],
	providers: [DashboardService, DashboardResolver],
})
export class DashboardModule {}
