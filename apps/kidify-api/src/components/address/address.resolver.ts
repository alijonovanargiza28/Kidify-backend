import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { Address, AddressInput } from './address';
import { AddressService } from './address.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { shapeIntoMongoObjectId } from '../../libs/config';
@Resolver()
@UseGuards(AuthGuard)
export class AddressResolver {
	constructor(private readonly service: AddressService) {}
	@Query(() => [Address]) getMyAddresses(@AuthMember('_id') memberId: Types.ObjectId) {
		return this.service.list(memberId);
	}
	@Mutation(() => Address) createAddress(
		@Args('input') input: AddressInput,
		@AuthMember('_id') memberId: Types.ObjectId,
	) {
		return this.service.create(memberId, input);
	}
	@Mutation(() => Address) updateAddress(
		@Args('addressId') id: string,
		@Args('input') input: AddressInput,
		@AuthMember('_id') memberId: Types.ObjectId,
	) {
		return this.service.update(memberId, shapeIntoMongoObjectId(id), input);
	}
	@Mutation(() => Boolean) removeAddress(@Args('addressId') id: string, @AuthMember('_id') memberId: Types.ObjectId) {
		return this.service.remove(memberId, shapeIntoMongoObjectId(id));
	}
	@Mutation(() => Address) setDefaultAddress(
		@Args('addressId') id: string,
		@AuthMember('_id') memberId: Types.ObjectId,
	) {
		return this.service.setDefault(memberId, shapeIntoMongoObjectId(id));
	}
}
