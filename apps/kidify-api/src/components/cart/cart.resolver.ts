import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { Cart, CartItemInput } from './cart';
import { CartService } from './cart.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { shapeIntoMongoObjectId } from '../../libs/config';
@Resolver()
@UseGuards(AuthGuard)
export class CartResolver {
	constructor(private readonly service: CartService) {}
	@Query(() => Cart) getMyCart(@AuthMember('_id') memberId: Types.ObjectId) {
		return this.service.get(memberId);
	}
	@Mutation(() => Cart) addToCart(@Args('input') input: CartItemInput, @AuthMember('_id') memberId: Types.ObjectId) {
		return this.service.add(memberId, input);
	}
	@Mutation(() => Cart) updateCartItem(
		@Args('itemId') id: string,
		@Args('quantity', { type: () => Int }) quantity: number,
		@AuthMember('_id') memberId: Types.ObjectId,
	) {
		return this.service.update(memberId, shapeIntoMongoObjectId(id), quantity);
	}
	@Mutation(() => Cart) removeCartItem(@Args('itemId') id: string, @AuthMember('_id') memberId: Types.ObjectId) {
		return this.service.remove(memberId, shapeIntoMongoObjectId(id));
	}
	@Mutation(() => Cart) clearCart(@AuthMember('_id') memberId: Types.ObjectId) {
		return this.service.clear(memberId);
	}
	@Mutation(() => Cart) moveFavoriteToCart(
		@Args('input') input: CartItemInput,
		@AuthMember('_id') memberId: Types.ObjectId,
	) {
		return this.service.favoriteToCart(memberId, input);
	}
	@Mutation(() => Cart) moveCartItemToFavorite(
		@Args('itemId') id: string,
		@AuthMember('_id') memberId: Types.ObjectId,
	) {
		return this.service.cartToFavorite(memberId, shapeIntoMongoObjectId(id));
	}
}
