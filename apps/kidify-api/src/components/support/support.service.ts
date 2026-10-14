import { Message } from '../../libs/enums/common.enum';
import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SupportTicket, SupportInput } from './support';
import { Member } from '../../libs/dto/member/member';
import { MemberType, MemberStatus } from '../../libs/enums/member.enum';
import { Order } from '../order/order';
import { SupportStatus } from '../../libs/enums/marketplace.enum';
import { PageInquiry, facet } from '../../libs/marketplace';
@Injectable()
export class SupportService {
	constructor(
		@InjectModel('Support') private readonly model: Model<SupportTicket>,
		@InjectModel('Member') private readonly members: Model<Member>,
		@InjectModel('Order') private readonly orders: Model<Order>,
	) {}
	access(actor: Member) {
		return actor.memberType === MemberType.ADMIN
			? {}
			: actor.memberType === MemberType.CS
				? { assignedCS: actor._id }
				: { creatorId: actor._id };
	}
	async create(memberId: Types.ObjectId, input: SupportInput) {
		if (input.relatedOrderId && !(await this.orders.exists({ _id: input.relatedOrderId, memberId })))
			throw new BadRequestException('ORDER_NOT_FOUND');
		return this.model.create({ ...input, creatorId: memberId });
	}
	async list(actor: Member, input: PageInquiry) {
		return (
			await this.model.aggregate([
				{ $match: this.access(actor) },
				{ $sort: { createdAt: input.oldest ? 1 : -1, _id: -1 } },
				facet(input),
			])
		)[0];
	}
	async get(actor: Member, id: Types.ObjectId) {
		const result = await this.model.findOne({ _id: id, ...this.access(actor) });
		if (!result) throw new NotFoundException('SUPPORT_NOT_FOUND');
		return result;
	}
	async assign(id: Types.ObjectId, csId: Types.ObjectId) {
		if (!(await this.members.exists({ _id: csId, memberType: MemberType.CS, memberStatus: MemberStatus.ACTIVE })))
			throw new BadRequestException('INVALID_CS');
		const result = await this.model.findOneAndUpdate(
			{ _id: id, status: { $in: [SupportStatus.OPEN, SupportStatus.IN_PROGRESS] } },
			{ $set: { assignedCS: csId, status: SupportStatus.IN_PROGRESS } },
			{ new: true },
		);
		if (!result) throw new NotFoundException('SUPPORT_NOT_FOUND');
		return result;
	}
	async claim(actor: Member, id: Types.ObjectId) {
		if (actor.memberType !== MemberType.CS) throw new ForbiddenException(Message.FORBIDDEN);
		const result = await this.model.findOneAndUpdate(
			{ _id: id, assignedCS: null, status: SupportStatus.OPEN },
			{ $set: { assignedCS: actor._id, status: SupportStatus.IN_PROGRESS } },
			{ new: true },
		);
		if (!result) throw new BadRequestException('SUPPORT_ALREADY_ASSIGNED');
		return result;
	}
	async queue(input: PageInquiry) {
		return (
			await this.model.aggregate([
				{ $match: { status: SupportStatus.OPEN, assignedCS: null } },
				{ $project: { message: 0, replies: 0, relatedOrderId: 0 } },
				{ $sort: { createdAt: 1 } },
				facet(input),
			])
		)[0];
	}
	async reply(actor: Member, id: Types.ObjectId, text: string) {
		if (!text.trim() || text.length > 5000) throw new BadRequestException('INVALID_REPLY');
		const result = await this.model.findOneAndUpdate(
			{ _id: id, ...this.access(actor), status: { $ne: SupportStatus.CLOSED } },
			{ $push: { replies: { authorId: actor._id, text, createdAt: new Date() } } },
			{ new: true },
		);
		if (!result) throw new NotFoundException('SUPPORT_NOT_FOUND');
		return result;
	}
	async status(actor: Member, id: Types.ObjectId, status: SupportStatus) {
		const ticket = await this.get(actor, id);
		const next: Record<SupportStatus, SupportStatus[]> = {
			OPEN: [SupportStatus.IN_PROGRESS, SupportStatus.CLOSED],
			IN_PROGRESS: [SupportStatus.RESOLVED, SupportStatus.CLOSED],
			RESOLVED: [SupportStatus.IN_PROGRESS, SupportStatus.CLOSED],
			CLOSED: [],
		};
		if (!next[ticket.status].includes(status)) throw new BadRequestException('INVALID_SUPPORT_TRANSITION');
		const result = await this.model.findOneAndUpdate(
			{ _id: id, ...this.access(actor), status: ticket.status },
			{ $set: { status } },
			{ new: true },
		);
		if (!result) throw new BadRequestException('SUPPORT_CHANGED_RETRY');
		return result;
	}
	async relatedOrder(actor: Member, ticketId: Types.ObjectId) {
		const ticket = await this.get(actor, ticketId);
		if (!ticket.relatedOrderId) throw new NotFoundException('ORDER_NOT_FOUND');
		return this.orders.findOne({ _id: ticket.relatedOrderId, memberId: ticket.creatorId });
	}
}
