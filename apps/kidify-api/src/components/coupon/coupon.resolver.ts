import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { Coupon, Coupons, CouponInput, CouponQuote } from './coupon';
import { CouponService } from './coupon.service';
import { CartService } from '../cart/cart.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { MemberType } from '../../libs/enums/member.enum';
import { PageInquiry } from '../../libs/marketplace';
import { shapeIntoMongoObjectId } from '../../libs/config';
@Resolver()
export class CouponResolver {
	constructor(
		private readonly service: CouponService,
		private readonly carts: CartService,
	) {}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Coupon)
	createCoupon(@Args('input') input: CouponInput, @AuthMember('_id') actor: Types.ObjectId) {
		return this.service.create(actor, input);
	}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Coupon)
	updateCoupon(@Args('couponId') id: string, @Args('input') input: CouponInput) {
		return this.service.update(shapeIntoMongoObjectId(id), input);
	}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Coupon)
	disableCoupon(@Args('couponId') id: string) {
		return this.service.disable(shapeIntoMongoObjectId(id));
	}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Query(() => Coupons)
	getCoupons(@Args('input') input: PageInquiry) {
		return this.service.list(input);
	}
	@UseGuards(AuthGuard)
	@Query(() => CouponQuote)
	async validateCoupon(@Args('code') code: string, @AuthMember('_id') memberId: Types.ObjectId) {
		return this.service.apply(code, (await this.carts.get(memberId)).subtotal);
	}
}
