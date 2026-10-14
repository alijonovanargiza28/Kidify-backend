import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Member } from '../../libs/dto/member/member';
import { Notification, NotificationsInquiry } from './notification';
import { NotificationGroup, NotificationStatus, NotificationType } from '../../libs/enums/notification.enum';
import { facet } from '../../libs/marketplace';
@Injectable()
export class NotificationService {
	constructor(
		@InjectModel('Notification') private readonly model: Model<Notification>,
		@InjectModel('Member') private readonly members: Model<Member>,
	) {}
	async send(
		receiverId: string | Types.ObjectId,
		authorId: string | Types.ObjectId,
		type: NotificationType,
		group: NotificationGroup,
		targetId: string | Types.ObjectId,
		title: string,
		session?: ClientSession,
	) {
		if (String(receiverId) === String(authorId) && ![NotificationType.ORDER, NotificationType.DELIVERY].includes(type))
			return;
		await this.model.create(
			[{ receiverId, authorId, notificationType: type, notificationGroup: group, targetId, notificationTitle: title }],
			{ session },
		);
	}
	async list(memberId: Types.ObjectId, input: NotificationsInquiry) {
		const match = {
			receiverId: memberId,
			notificationGroup: { $in: Object.values(NotificationGroup) },
			...(input.filter === 'UNREAD'
				? { notificationStatus: NotificationStatus.WAIT }
				: input.filter === 'READ'
					? { notificationStatus: NotificationStatus.READ }
					: {}),
		};
		return (
			await this.model.aggregate([
				{ $match: match },
				{ $sort: { createdAt: input.oldest ? 1 : -1, _id: -1 } },
				facet(input),
			])
		)[0];
	}
	count(memberId: Types.ObjectId) {
		return this.model.countDocuments({ receiverId: memberId, notificationGroup: { $in: Object.values(NotificationGroup) }, notificationStatus: NotificationStatus.WAIT });
	}
	async read(memberId: Types.ObjectId, id: Types.ObjectId) {
		const result = await this.model.findOneAndUpdate(
			{ _id: id, receiverId: memberId, notificationGroup: { $in: Object.values(NotificationGroup) } },
			{ $set: { notificationStatus: NotificationStatus.READ } },
			{ new: true },
		);
		if (!result) throw new NotFoundException('NOTIFICATION_NOT_FOUND');
		return result;
	}
 async readChat(memberId: Types.ObjectId, peerId: Types.ObjectId) {
  await this.model.updateMany({ receiverId: memberId, authorId: peerId, notificationGroup: NotificationGroup.MESSAGE, notificationStatus: NotificationStatus.WAIT }, { $set: { notificationStatus: NotificationStatus.READ } });
 }
	async readAll(memberId: Types.ObjectId) {
		await this.model.updateMany(
			{ receiverId: memberId, notificationGroup: { $in: Object.values(NotificationGroup) }, notificationStatus: NotificationStatus.WAIT },
			{ $set: { notificationStatus: NotificationStatus.READ } },
		);
		return true;
	}
	async announce(
		actorId: Types.ObjectId,
		title: string,
		targetId: Types.ObjectId = actorId,
		type = NotificationType.SYSTEM,
		group = NotificationGroup.MEMBER,
	) {
		if (!title.trim() || title.length > 200) throw new Error('INVALID_ANNOUNCEMENT');
		const cursor = this.members
			.find({ memberStatus: 'ACTIVE', _id: { $ne: actorId } })
			.select('_id')
			.lean()
			.cursor();
		let batch: Array<{
			receiverId: string;
			authorId: Types.ObjectId;
			notificationType: NotificationType;
			notificationGroup: NotificationGroup;
			targetId: Types.ObjectId;
			notificationTitle: string;
		}> = [];
		for await (const member of cursor) {
			batch.push({
				receiverId: member._id,
				authorId: actorId,
				notificationType: type,
				notificationGroup: group,
				targetId,
				notificationTitle: title,
			});
			if (batch.length === 100) {
				await this.model.insertMany(batch);
				batch = [];
			}
		}
		if (batch.length) await this.model.insertMany(batch);
		return true;
	}
}
