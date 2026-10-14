import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MemberType } from '../../libs/enums/member.enum';
import { OrdersInquiry } from '../order/order';
import { Payment, Payments } from './payment';
import { OrderService } from '../order/order.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Member } from '../../libs/dto/member/member';
import { shapeIntoMongoObjectId } from '../../libs/config';
@Resolver()
@UseGuards(AuthGuard)
export class PaymentResolver {
	constructor(private readonly service: OrderService) {}
	@Query(() => Payment) getPayment(@Args('paymentId') id: string, @AuthMember() actor: Member) {
		return this.service.paymentGet(actor, shapeIntoMongoObjectId(id));
	}
	@Mutation(() => Payment) payOrderDemo(@Args('paymentId') id: string, @AuthMember('_id') memberId: Types.ObjectId) {
		return this.service.pay(memberId, shapeIntoMongoObjectId(id));
	}
	@Mutation(() => Payment) failPaymentDemo(@Args('paymentId') id: string, @AuthMember('_id') memberId: Types.ObjectId) {
		return this.service.pay(memberId, shapeIntoMongoObjectId(id), true);
	}
	@Roles(MemberType.ADMIN) @UseGuards(RolesGuard) @Query(() => Payments) getPaymentsByAdmin(
		@Args('input') input: OrdersInquiry,
	) {
		return this.service.paymentList(input);
	}
}
