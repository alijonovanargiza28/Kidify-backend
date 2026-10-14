import { Resolver, Args, Mutation, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { Brand, Brands, BrandInput } from './brand';
import { BrandService } from './brand.service';

import { Roles } from '../auth/decorators/roles.decorator';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType } from '../../libs/enums/member.enum';

import { PageInquiry } from '../../libs/marketplace';
import { shapeIntoMongoObjectId } from '../../libs/config';
@Resolver()
export class BrandResolver {
	constructor(private readonly service: BrandService) {}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Brand)
	createBrand(@Args('input') input: BrandInput, @AuthMember('_id') actor: Types.ObjectId) {
		return this.service.create(actor, input);
	}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Brand)
	updateBrand(@Args('id') id: string, @Args('input') input: BrandInput) {
		return this.service.update(shapeIntoMongoObjectId(id), input);
	}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Brand)
	removeBrand(@Args('id') id: string) {
		return this.service.remove(shapeIntoMongoObjectId(id));
	}
	@Query(() => Brand) getBrand(@Args('id') id: string) {
		return this.service.get(shapeIntoMongoObjectId(id));
	}
	@Query(() => Brands) getBrands(@Args('input') input: PageInquiry, @Args('text', { nullable: true }) text?: string) {
		return this.service.list(input, text);
	}
	@Roles(MemberType.ADMIN) @UseGuards(RolesGuard) @Query(() => Brands) getBrandsByAdmin(
		@Args('input') input: PageInquiry,
	) {
		return this.service.list(input, undefined, undefined, true);
	}
}
