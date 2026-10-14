import { Resolver, Args, Mutation, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { FAQ, FAQs, FAQInput } from './faq';
import { FAQService } from './faq.service';

import { Roles } from '../auth/decorators/roles.decorator';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType } from '../../libs/enums/member.enum';
import { FAQCategory } from '../../libs/enums/marketplace.enum';
import { PageInquiry } from '../../libs/marketplace';
import { shapeIntoMongoObjectId } from '../../libs/config';
@Resolver()
export class FAQResolver {
	constructor(private readonly service: FAQService) {}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => FAQ)
	createFAQ(@Args('input') input: FAQInput, @AuthMember('_id') actor: Types.ObjectId) {
		return this.service.create(actor, input);
	}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => FAQ)
	updateFAQ(@Args('id') id: string, @Args('input') input: FAQInput) {
		return this.service.update(shapeIntoMongoObjectId(id), input);
	}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => FAQ)
	removeFAQ(@Args('id') id: string) {
		return this.service.remove(shapeIntoMongoObjectId(id));
	}
	@Query(() => FAQ) getFAQ(@Args('id') id: string) {
		return this.service.get(shapeIntoMongoObjectId(id));
	}
	@Query(() => FAQs) getFAQs(
		@Args('input') input: PageInquiry,
		@Args('text', { nullable: true }) text?: string,
		@Args('category', { type: () => FAQCategory, nullable: true }) category?: FAQCategory,
	) {
		return this.service.list(input, text, category);
	}
	@Roles(MemberType.ADMIN) @UseGuards(RolesGuard) @Query(() => FAQs) getFAQsByAdmin(@Args('input') input: PageInquiry) {
		return this.service.list(input, undefined, undefined, true);
	}
}
