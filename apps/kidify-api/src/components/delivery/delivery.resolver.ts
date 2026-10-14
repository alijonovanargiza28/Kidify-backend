import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Delivery, Deliveries } from './delivery';
import { OrderService } from '../order/order.service';
import { OrdersInquiry } from '../order/order';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Member } from '../../libs/dto/member/member';
import { MemberType } from '../../libs/enums/member.enum';
import { OrderStatus } from '../../libs/enums/marketplace.enum';
import { shapeIntoMongoObjectId } from '../../libs/config';
@Resolver()
export class DeliveryResolver {
	constructor(private readonly service: OrderService) {}
	@UseGuards(AuthGuard) @Query(() => Delivery) getDelivery(
		@Args('deliveryId') id: string,
		@AuthMember() actor: Member,
	) {
		return this.service.deliveryGet(actor, shapeIntoMongoObjectId(id));
	}
	@Roles(MemberType.ADMIN, MemberType.CS)
	@UseGuards(RolesGuard)
	@Query(() => Deliveries)
	getDeliveries(@Args('input') input: OrdersInquiry) {
		return this.service.deliveryList(input);
	}
	@Roles(MemberType.ADMIN, MemberType.CS)
	@UseGuards(RolesGuard)
	@Mutation(() => Delivery)
	updateDeliveryStatus(
		@Args('orderId') id: string,
		@Args('status', { type: () => OrderStatus }) status: OrderStatus,
		@Args('trackingCode', { nullable: true }) trackingCode: string,
		@AuthMember() actor: Member,
	) {
		return this.service.delivery(actor, shapeIntoMongoObjectId(id), status, trackingCode);
	}
}
