import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { Order, Orders, SellerOrders, SellerOrder, CheckoutInput, OrdersInquiry } from './order';
import { OrderService } from './order.service';
import { Cart } from '../cart/cart';
import { Member } from '../../libs/dto/member/member';
import { MemberType } from '../../libs/enums/member.enum';
import { OrderStatus } from '../../libs/enums/marketplace.enum';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { shapeIntoMongoObjectId } from '../../libs/config';
@Resolver()
@UseGuards(AuthGuard)
export class OrderResolver {
	constructor(private readonly service: OrderService) {}
	@Mutation(() => Order) createOrder(@Args('input') input: CheckoutInput, @AuthMember('_id') memberId: Types.ObjectId) {
		return this.service.checkout(memberId, input);
	}
	@Query(() => Orders) getMyOrders(@Args('input') input: OrdersInquiry, @AuthMember('_id') memberId: Types.ObjectId) {
		return this.service.list(memberId, input);
	}
	@Query(() => Order) getOrder(@Args('orderId') id: string, @AuthMember() actor: Member) {
		return this.service.get(actor, shapeIntoMongoObjectId(id));
	}
	@Mutation(() => Order) cancelOrder(@Args('orderId') id: string, @AuthMember() actor: Member) {
		return this.service.cancel(actor, shapeIntoMongoObjectId(id));
	}
	@Mutation(() => Cart) buyAgain(@Args('orderId') id: string, @AuthMember('_id') memberId: Types.ObjectId) {
		return this.service.buyAgain(memberId, shapeIntoMongoObjectId(id));
	}
	@Roles(MemberType.SELLER)
	@UseGuards(RolesGuard)
	@Query(() => SellerOrders)
	getSellerOrders(@Args('input') input: OrdersInquiry, @AuthMember('_id') sellerId: Types.ObjectId) {
		return this.service.sellerList(sellerId, input);
	}
	@Roles(MemberType.SELLER)
	@UseGuards(RolesGuard)
	@Mutation(() => SellerOrder)
	updateSellerOrderItemStatus(
		@Args('orderId') orderId: string,
		@Args('itemId') itemId: string,
		@Args('status', { type: () => OrderStatus }) status: OrderStatus,
		@AuthMember('_id') sellerId: Types.ObjectId,
	) {
		return this.service.prepare(sellerId, shapeIntoMongoObjectId(orderId), shapeIntoMongoObjectId(itemId), status);
	}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => Orders)
	getAllOrdersByAdmin(@Args('input') input: OrdersInquiry) {
		return this.service.list(undefined, input);
	}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Order)
	updateOrderStatusByAdmin(
		@Args('orderId') id: string,
		@Args('status', { type: () => OrderStatus }) status: OrderStatus,
		@AuthMember() actor: Member,
	) {
		return this.service.adminStatus(actor, shapeIntoMongoObjectId(id), status);
	}
}
