import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrderModule } from '../order/order.module';
import { DeliveryResolver } from './delivery.resolver';
@Module({ imports: [AuthModule, OrderModule], providers: [DeliveryResolver] })
export class DeliveryModule {}
