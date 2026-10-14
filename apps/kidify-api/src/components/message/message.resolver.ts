import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { ChatMessage, ChatMessages, MessageInput } from './message';
import { MessageService } from './message.service';
import { Member } from '../../libs/dto/member/member';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { PageInquiry } from '../../libs/marketplace';
import { shapeIntoMongoObjectId } from '../../libs/config';
@Resolver()
@UseGuards(AuthGuard)
export class MessageResolver {
	constructor(private readonly service: MessageService) {}
	@Mutation(() => ChatMessage) sendMessage(@Args('input') input: MessageInput, @AuthMember() actor: Member) {
		return this.service.send(actor, input);
	}
	@Query(() => ChatMessages) getMyMessages(
		@Args('input') input: PageInquiry,
		@Args('peerId', { nullable: true }) peerId: string,
		@AuthMember('_id') memberId: Types.ObjectId,
	) {
		return this.service.list(memberId, peerId ? shapeIntoMongoObjectId(peerId) : undefined, input);
	}
	@Mutation(() => ChatMessage) markMessageRead(
		@Args('messageId') id: string,
		@AuthMember('_id') memberId: Types.ObjectId,
	) {
		return this.service.read(memberId, shapeIntoMongoObjectId(id));
	}
}
