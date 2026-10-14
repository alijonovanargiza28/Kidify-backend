import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { SellerCodeSchema } from './seller-code';
import { SellerCodeService } from './seller-code.service';
import { SellerCodeResolver } from './seller-code.resolver';
@Module({
	imports: [AuthModule, MongooseModule.forFeature([{ name: 'SellerCode', schema: SellerCodeSchema }])],
	providers: [SellerCodeService, SellerCodeResolver],
	exports: [SellerCodeService],
})
export class SellerCodeModule {}
