import { Message } from "../../libs/enums/common.enum";
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { ChatMessage, MessageInput } from "./message";
import { Member } from "../../libs/dto/member/member";
import { MemberType, MemberStatus } from "../../libs/enums/member.enum";
import { Product } from "../product/product";
import { ProductStatus } from "../../libs/enums/product.enum";
import { PageInquiry, facet, escapeSearch } from "../../libs/marketplace";
import { NotificationService } from "../notification/notification.service";
import {
  NotificationType,
  NotificationGroup,
} from "../../libs/enums/notification.enum";
@Injectable()
export class MessageService {
  onMessage?: (message: any) => Promise<void>;
  onRead?: (data: any) => Promise<void>;
  constructor(
    @InjectModel("ChatState") private readonly states: Model<any>,
    @InjectModel("ChatQuota") private readonly quotas: Model<any>,
    @InjectModel("Message") private readonly model: Model<ChatMessage>,
    @InjectModel("Member") private readonly members: Model<Member>,
    @InjectModel("Product") private readonly products: Model<Product>,
    private readonly notifications: NotificationService,
  ) {}
  async send(actor: Member, input: MessageInput) {
    if (String(actor._id) === input.receiverId)
      throw new BadRequestException("SELF_MESSAGE_DENIED");
    const receiver = await this.members.findOne({
      _id: input.receiverId,
      memberStatus: MemberStatus.ACTIVE,
    });
    if (!receiver) throw new NotFoundException("RECEIVER_NOT_FOUND");
    if (input.productId) {
      const product = await this.products.findOne({
        _id: input.productId,
        productStatus: { $in: [ProductStatus.ACTIVE, ProductStatus.SOLD_OUT] },
      });
      if (
        !product ||
        ![String(actor._id), String(receiver._id)].includes(
          String(product.productSellerId),
        )
      )
        throw new BadRequestException("INVALID_PRODUCT");
    }
    if (!input.text.trim() || input.text.length > 3000)
      throw new BadRequestException("INVALID_MESSAGE");
    if (input.clientMessageId) {
      const previous = await this.model.findOne({
        senderId: actor._id,
        clientMessageId: input.clientMessageId,
      });
      if (previous) return previous;
    }
    await this.quota(String(actor._id), "message", 20, 60000);
    let message;
    try {
      message = await this.model.create({
        ...input,
        text: input.text.trim(),
        senderId: actor._id,
        scope: "PRIVATE",
      });
    } catch (error) {
      if (error?.code === 11000 && input.clientMessageId)
        return this.model.findOne({
          senderId: actor._id,
          clientMessageId: input.clientMessageId,
        });
      throw error;
    }
    await this.notifications.send(
      receiver._id,
      actor._id,
      NotificationType.MESSAGE,
      NotificationGroup.MESSAGE,
      actor._id,
      "New message",
    );
    await this.onMessage?.(await this.decorate(message.toObject()));
    return message;
  }
  async list(
    memberId: Types.ObjectId,
    peer: Types.ObjectId | undefined,
    input: PageInquiry,
  ) {
    const match = peer
      ? {
          $or: [
            { senderId: memberId, receiverId: peer },
            { senderId: peer, receiverId: memberId },
          ],
        }
      : { $or: [{ senderId: memberId }, { receiverId: memberId }] };
    return (
      await this.model.aggregate([
        { $match: { ...match, receiverId: { $exists: true } } },
        { $sort: { createdAt: input.oldest ? 1 : -1, _id: -1 } },
        facet(input),
      ])
    )[0];
  }
  async read(memberId: Types.ObjectId, id: Types.ObjectId) {
    const message = await this.model.findOneAndUpdate(
      { _id: id, receiverId: memberId },
      { $set: { isRead: true } },
      { new: true },
    );
    if (!message) throw new NotFoundException("MESSAGE_NOT_FOUND");
    await this.onRead?.({
      senderId: String(message.senderId),
      receiverId: String(memberId),
      ids: [String(message._id)],
    });
    return message;
  }

  async quota(
    memberId: string,
    action: string,
    limit: number,
    windowMs: number,
  ) {
    const now = Date.now(),
      bucket = Math.floor(now / windowMs);
    const key = `${action}:${memberId}:${bucket}`;
    // Increment atomically; over-budget attempts stay over budget across sockets/processes.
    let result;
    try {
      result = await this.quotas.findOneAndUpdate(
        { key },
        {
          $inc: { count: 1 },
          $setOnInsert: { expiresAt: new Date((bucket + 2) * windowMs) },
        },
        { upsert: true, new: true },
      );
    } catch (e) {
      if (e?.code !== 11000) throw e;
      result = await this.quotas.findOneAndUpdate(
        { key },
        { $inc: { count: 1 } },
        { new: true },
      );
    }
    if (!result || result.count > limit)
      throw new BadRequestException("RATE_LIMITED");
  }
  async globalAccess(memberId: string, writing = false) {
    const state = await this.states.findOne({ memberId });
    if (state?.blocked || (writing && state?.mutedUntil > new Date()))
      throw new ForbiddenException("CHAT_RESTRICTED");
  }
  async decorate(message: any) {
    const sender = await this.members
      .findById(message.senderId)
      .select("_id memberNick memberImage memberType")
      .lean();
    return { ...message, sender };
  }
  async globalSend(actor: Member, text: string, clientMessageId: string) {
    await this.globalAccess(String(actor._id), true);
    const prior = await this.model.findOne({
      senderId: actor._id,
      clientMessageId,
    });
    if (prior) return this.decorate(prior.toObject());
    await this.quota(String(actor._id), "message", 20, 60000);
    if (!text.trim() || text.length > 3000)
      throw new BadRequestException("INVALID_MESSAGE");
    let message;
    try {
      message = await this.model.create({
        senderId: actor._id,
        scope: "GLOBAL",
        text: text.trim(),
        clientMessageId,
      });
    } catch (e) {
      if (e?.code !== 11000) throw e;
      const existing = await this.model.findOne({
        senderId: actor._id,
        clientMessageId,
      });
      if (!existing) throw e;
      return this.decorate(existing.toObject());
    }
    const result = await this.decorate(message.toObject());
    await this.onMessage?.(result);
    return result;
  }
  async history(memberId: string, peerId?: string, before?: string) {
    if (!peerId) await this.globalAccess(memberId);
    const id = new Types.ObjectId(memberId),
      peer = peerId ? new Types.ObjectId(peerId) : null;
    const match = peer
      ? {
          $or: [
            { senderId: id, receiverId: peer },
            { senderId: peer, receiverId: id },
          ],
        }
      : { scope: "GLOBAL" };
    const rows = await this.model
      .find({
        ...match,
        deletedAt: null,
        ...(before ? { _id: { $lt: new Types.ObjectId(before) } } : {}),
      })
      .sort({ _id: -1 })
      .limit(31)
      .lean();
    return {
      messages: await Promise.all(
        rows.slice(0, 30).map((row) => this.decorate(row)),
      ),
      hasMore: rows.length > 30,
    };
  }
  async conversations(memberId: string, before?: string) {
    const id = new Types.ObjectId(memberId);
    return this.model.aggregate([
      {
        $match: {
          $or: [{ senderId: id }, { receiverId: id }],
          receiverId: { $exists: true },
          deletedAt: null,
        },
      },
      { $sort: { _id: -1 } },
      {
        $group: {
          _id: {
            $cond: [{ $eq: ["$senderId", id] }, "$receiverId", "$senderId"],
          },
          last: { $first: "$$ROOT" },
          unread: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$receiverId", id] },
                    { $eq: ["$isRead", false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      ...(before
        ? [{ $match: { "last._id": { $lt: new Types.ObjectId(before) } } }]
        : []),
      { $sort: { "last._id": -1 } },
      { $limit: 31 },
      {
        $lookup: {
          from: "members",
          localField: "_id",
          foreignField: "_id",
          as: "peer",
        },
      },
      { $unwind: "$peer" },
      {
        $project: {
          _id: 1,
          last: 1,
          unread: 1,
          "peer._id": 1,
          "peer.memberNick": 1,
          "peer.memberImage": 1,
          "peer.memberType": 1,
        },
      },
    ]);
  }
  async counts(memberId: string) {
    let state;
    try {
      state = await this.states.findOneAndUpdate(
        { memberId },
        { $setOnInsert: { globalReadAt: new Date() } },
        { upsert: true, new: true },
      );
    } catch (error) {
      if (error?.code !== 11000) throw error;
      state = await this.states.findOne({ memberId });
    }
    const privateCount = await this.model.countDocuments({
      receiverId: memberId,
      isRead: false,
      deletedAt: null,
    });
    const globalCount = state?.blocked
      ? 0
      : await this.model.countDocuments({
          scope: "GLOBAL",
          senderId: { $ne: memberId },
          deletedAt: null,
          createdAt: { $gt: state?.globalReadAt ?? new Date() },
        });
    return { private: privateCount, global: globalCount };
  }
  async markRead(memberId: string, peerId?: string, through?: string) {
    if (!peerId) {
      await this.globalAccess(memberId);
      // Use the last displayed message's server timestamp, never mark unseen future messages read.
      const last = through
        ? await this.model.findOne({ _id: through, scope: "GLOBAL" })
        : null;
      if (last)
        await this.states.updateOne(
          { memberId },
          { $max: { globalReadAt: (last as any).createdAt } },
          { upsert: true },
        );
      return true;
    }
    const match = {
      senderId: new Types.ObjectId(peerId),
      receiverId: new Types.ObjectId(memberId),
      isRead: false,
      ...(through ? { _id: { $lte: new Types.ObjectId(through) } } : {}),
    };
    await this.model.updateMany(match, { $set: { isRead: true } });
    if (
      !(await this.model.countDocuments({
        senderId: peerId,
        receiverId: memberId,
        isRead: false,
      }))
    )
      await this.notifications.readChat(
        new Types.ObjectId(memberId),
        new Types.ObjectId(peerId),
      );
    await this.onRead?.({ senderId: peerId, receiverId: memberId, through });
    return true;
  }
  async contacts(search: string, csOnly = false) {
    const escaped = escapeSearch(search);
    return this.members
      .find({
        memberStatus: MemberStatus.ACTIVE,
        ...(csOnly ? { memberType: MemberType.CS } : {}),
        ...(search ? { memberNick: { $regex: escaped, $options: "i" } } : {}),
      })
      .select("_id memberNick memberImage memberType")
      .limit(20)
      .lean();
  }
  async moderate(actor: Member, action: string, target: string) {
    if (actor.memberType !== MemberType.ADMIN)
      throw new ForbiddenException("FORBIDDEN");
    if (action === "delete") {
      const row = await this.model.findOneAndUpdate(
        { _id: target, scope: "GLOBAL" },
        { $set: { deletedAt: new Date(), text: "" } },
        { new: true },
      );
      if (!row) throw new NotFoundException("MESSAGE_NOT_FOUND");
    } else {
      if (target === String(actor._id))
        throw new BadRequestException("INVALID_TARGET");
      const member = await this.members.findById(target);
      if (!member || member.memberType === MemberType.ADMIN)
        throw new BadRequestException("INVALID_TARGET");
      await this.states.updateOne(
        { memberId: target },
        {
          $set: {
            moderatedBy: actor._id,
            blocked: action === "block",
            mutedUntil:
              action === "mute" ? new Date(Date.now() + 3600000) : null,
          },
        },
        { upsert: true },
      );
    }
    return true;
  }
}
