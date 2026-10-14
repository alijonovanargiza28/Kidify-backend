import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import CouponSchema from '../../schemas/Coupon.model';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { CouponService } from './coupon.service';
import { CouponResolver } from './coupon.resolver';
@Module({
	imports: [AuthModule, CartModule, MongooseModule.forFeature([{ name: 'Coupon', schema: CouponSchema }])],
	providers: [CouponService, CouponResolver],
	exports: [CouponService],
})
export class CouponModule {}
