import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import SupportSchema from '../../schemas/Support.model';
import OrderSchema from '../../schemas/Order.model';
import MemberSchema from '../../schemas/Member.model';
import { SupportService } from './support.service';
import { SupportResolver } from './support.resolver';
@Module({
	imports: [
		AuthModule,
		MongooseModule.forFeature([
			{ name: 'Support', schema: SupportSchema },
			{ name: 'Order', schema: OrderSchema },
			{ name: 'Member', schema: MemberSchema },
		]),
	],
	providers: [SupportService, SupportResolver],
	exports: [SupportService],
})
export class SupportModule {}
