import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrderModule } from '../order/order.module';
import { PaymentResolver } from './payment.resolver';
@Module({ imports: [AuthModule, OrderModule], providers: [PaymentResolver] })
export class PaymentModule {}
