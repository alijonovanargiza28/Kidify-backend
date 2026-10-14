import { Resolver, Args, Mutation, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { Event, Events, EventInput } from './event';
import { EventService } from './event.service';

import { Roles } from '../auth/decorators/roles.decorator';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType } from '../../libs/enums/member.enum';

import { PageInquiry } from '../../libs/marketplace';
import { shapeIntoMongoObjectId } from '../../libs/config';
@Resolver()
export class EventResolver {
	constructor(private readonly service: EventService) {}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Event)
	createEvent(@Args('input') input: EventInput, @AuthMember('_id') actor: Types.ObjectId) {
		return this.service.create(actor, input);
	}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Event)
	updateEvent(@Args('id') id: string, @Args('input') input: EventInput) {
		return this.service.update(shapeIntoMongoObjectId(id), input);
	}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => Event)
	removeEvent(@Args('id') id: string) {
		return this.service.remove(shapeIntoMongoObjectId(id));
	}
	@Query(() => Event) getEvent(@Args('id') id: string) {
		return this.service.get(shapeIntoMongoObjectId(id));
	}
	@Query(() => Events) getEvents(@Args('input') input: PageInquiry, @Args('text', { nullable: true }) text?: string) {
		return this.service.list(input, text);
	}
	@Roles(MemberType.ADMIN) @UseGuards(RolesGuard) @Query(() => Events) getEventsByAdmin(
		@Args('input') input: PageInquiry,
	) {
		return this.service.list(input, undefined, undefined, true);
	}
}
