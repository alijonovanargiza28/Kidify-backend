import { Resolver, Query, Mutation, Args, Field, ObjectType } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { SupportTicket, SupportTickets, SupportInput } from './support';
import { SupportService } from './support.service';
import { Member } from '../../libs/dto/member/member';
import { MemberType } from '../../libs/enums/member.enum';
import { SupportStatus } from '../../libs/enums/marketplace.enum';
import { Order } from '../order/order';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { PageInquiry } from '../../libs/marketplace';
import { shapeIntoMongoObjectId } from '../../libs/config';
@ObjectType()
export class SupportQueueItem {
	@Field(() => String) _id!: string;
	@Field(() => String) subject!: string;
	@Field(() => Date) createdAt!: Date;
}
@ObjectType()
export class SupportQueue {
	@Field(() => [SupportQueueItem]) list!: SupportQueueItem[];
}
@Resolver()
@UseGuards(AuthGuard)
export class SupportResolver {
	constructor(private readonly service: SupportService) {}
	@Mutation(() => SupportTicket) createSupportTicket(
		@Args('input') input: SupportInput,
		@AuthMember('_id') memberId: Types.ObjectId,
	) {
		return this.service.create(memberId, input);
	}
	@Query(() => SupportTickets) getMySupportTickets(@Args('input') input: PageInquiry, @AuthMember() actor: Member) {
		return this.service.list(actor, input);
	}
	@Query(() => SupportTicket) getSupportTicket(@Args('ticketId') id: string, @AuthMember() actor: Member) {
		return this.service.get(actor, shapeIntoMongoObjectId(id));
	}
	@Mutation(() => SupportTicket) replySupportTicket(
		@Args('ticketId') id: string,
		@Args('text') text: string,
		@AuthMember() actor: Member,
	) {
		return this.service.reply(actor, shapeIntoMongoObjectId(id), text);
	}
	@Roles(MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => SupportTicket)
	assignSupportTicket(@Args('ticketId') id: string, @Args('csId') csId: string) {
		return this.service.assign(shapeIntoMongoObjectId(id), shapeIntoMongoObjectId(csId));
	}
	@Roles(MemberType.ADMIN, MemberType.CS)
	@UseGuards(RolesGuard)
	@Query(() => SupportQueue)
	getSupportQueue(@Args('input') input: PageInquiry) {
		return this.service.queue(input);
	}
	@Roles(MemberType.CS)
	@UseGuards(RolesGuard)
	@Mutation(() => SupportTicket)
	claimSupportTicket(@Args('ticketId') id: string, @AuthMember() actor: Member) {
		return this.service.claim(actor, shapeIntoMongoObjectId(id));
	}
	@Roles(MemberType.ADMIN, MemberType.CS)
	@UseGuards(RolesGuard)
	@Mutation(() => SupportTicket)
	updateSupportTicketStatus(
		@Args('ticketId') id: string,
		@Args('status', { type: () => SupportStatus }) status: SupportStatus,
		@AuthMember() actor: Member,
	) {
		return this.service.status(actor, shapeIntoMongoObjectId(id), status);
	}
	@Roles(MemberType.ADMIN, MemberType.CS)
	@UseGuards(RolesGuard)
	@Query(() => Order, { nullable: true })
	getSupportOrder(@Args('ticketId') id: string, @AuthMember() actor: Member) {
		return this.service.relatedOrder(actor, shapeIntoMongoObjectId(id));
	}
}
