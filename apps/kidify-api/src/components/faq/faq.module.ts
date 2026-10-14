import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import FAQSchema from '../../schemas/FAQ.model';
import { FAQService } from './faq.service';
import { FAQResolver } from './faq.resolver';
@Module({
	imports: [AuthModule, MongooseModule.forFeature([{ name: 'FAQ', schema: FAQSchema }])],
	providers: [FAQService, FAQResolver],
	exports: [FAQService],
})
export class FAQModule {}
