import { shapeIntoMongoObjectId } from '../../libs/config';
import { NotificationService } from '../notification/notification.service';
import { NotificationType, NotificationGroup } from '../../libs/enums/notification.enum';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Event, EventInput } from './event';
import { ContentStatus, FAQCategory } from '../../libs/enums/marketplace.enum';
import { PageInquiry, facet, escapeSearch } from '../../libs/marketplace';
@Injectable()
export class EventService {
	constructor(
		@InjectModel('Event') private readonly model: Model<Event>,
		private readonly notifications: NotificationService,
	) {}
	async create(actor: Types.ObjectId, input: EventInput) {
		if (input.endAt <= input.startAt) throw new BadRequestException('INVALID_EVENT_DATES');
		const event = await this.model.create({ ...input, createdBy: actor });
		if (event.status === ContentStatus.ACTIVE)
			await this.notifications.announce(
				actor,
				event.title,
				shapeIntoMongoObjectId(event._id),
				NotificationType.EVENT,
				NotificationGroup.EVENT,
			);
		return event;
	}
	async update(id: Types.ObjectId, input: EventInput) {
		if (input.endAt <= input.startAt) throw new BadRequestException('INVALID_EVENT_DATES');
		const result = await this.model.findOneAndUpdate(
			{ _id: id, status: { $ne: ContentStatus.DELETE } },
			{ $set: input },
			{ new: true, runValidators: true },
		);
		if (!result) throw new NotFoundException('EVENT_NOT_FOUND');
		return result;
	}
	async remove(id: Types.ObjectId) {
		const result = await this.model.findByIdAndUpdate(
			id,
			{ $set: { status: ContentStatus.DELETE, deletedAt: new Date() } },
			{ new: true },
		);
		if (!result) throw new NotFoundException('EVENT_NOT_FOUND');
		return result;
	}
	async get(id: Types.ObjectId) {
		const result = await this.model.findOne({ _id: id, status: ContentStatus.ACTIVE });
		if (!result) throw new NotFoundException('EVENT_NOT_FOUND');
		return result;
	}
	async list(input: PageInquiry, text?: string, category?: FAQCategory, admin = false) {
		const match = {
			...(!admin ? { status: ContentStatus.ACTIVE } : {}),
			...(text ? { title: { $regex: escapeSearch(text), $options: 'i' } } : {}),
			...(category ? { category } : {}),
		};
		return (
			await this.model.aggregate([
				{ $match: match },
				{ $sort: { createdAt: input.oldest ? 1 : -1, _id: -1 } },
				facet(input),
			])
		)[0];
	}
}
