import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import BrandSchema from '../../schemas/Brand.model';
import { BrandService } from './brand.service';
import { BrandResolver } from './brand.resolver';
@Module({
	imports: [AuthModule, MongooseModule.forFeature([{ name: 'Brand', schema: BrandSchema }])],
	providers: [BrandService, BrandResolver],
	exports: [BrandService],
})
export class BrandModule {}
