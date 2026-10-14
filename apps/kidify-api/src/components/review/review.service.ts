import { LikeService } from "../like/like.service";
import { LikeGroup } from "../../libs/enums/like.enum";
import { MemberType } from "../../libs/enums/member.enum";
import { ForbiddenException } from "@nestjs/common";
import { Message } from "../../libs/enums/common.enum";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel, InjectConnection } from "@nestjs/mongoose";
import { Model, Types, Connection, ClientSession } from "mongoose";
import { Review, ReviewInput } from "./review";
import { Order } from "../order/order";
import { Product } from "../product/product";
import { Member } from "../../libs/dto/member/member";
import {
  ReviewGroup,
  OrderStatus,
  ContentStatus,
  PaymentStatus,
} from "../../libs/enums/marketplace.enum";
import { atomic, PageInquiry, facet } from "../../libs/marketplace";
import { shapeIntoMongoObjectId } from "../../libs/config";
@Injectable()
export class ReviewService {
  constructor(
    private readonly likes: LikeService,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel("Review") private readonly reviews: Model<Review>,
    @InjectModel("Order") private readonly orders: Model<Order>,
    @InjectModel("Product") private readonly products: Model<Product>,
    @InjectModel("Member") private readonly members: Model<Member>,
  ) {}
  async recalculate(
    group: ReviewGroup,
    targetId: Types.ObjectId,
    session: ClientSession,
  ) {
    const [stats] = await this.reviews
      .aggregate([
        { $match: { group, targetId, status: ContentStatus.ACTIVE } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$rating" },
            count: { $sum: 1 },
          },
        },
      ])
      .session(session);
    const fields = {
      averageRating: stats?.averageRating ?? 0,
      [group === ReviewGroup.PRODUCT ? "productReviews" : "memberReviews"]:
        stats?.count ?? 0,
    };
    if (group === ReviewGroup.PRODUCT)
      await this.products.updateOne(
        { _id: targetId },
        { $set: fields },
        { session },
      );
    else
      await this.members.updateOne(
        { _id: targetId },
        { $set: fields },
        { session },
      );
  }
  async create(authorId: Types.ObjectId, input: ReviewInput) {
    if (![ReviewGroup.PRODUCT, ReviewGroup.SELLER].includes(input.group))
      throw new BadRequestException("INVALID_REVIEW_GROUP");
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
      throw new BadRequestException("INVALID_RATING");
    try {
      return await atomic(this.connection, async (session) => {
        const order = await this.orders
          .findOne({
            _id: shapeIntoMongoObjectId(input.orderId),
            memberId: authorId,
            status: OrderStatus.DELIVERED,
            paymentStatus: PaymentStatus.PAID,
            items: {
              $elemMatch: {
                [input.group === ReviewGroup.PRODUCT
                  ? "productId"
                  : "sellerId"]: shapeIntoMongoObjectId(input.targetId),
                status: OrderStatus.DELIVERED,
              },
            },
          })
          .session(session);
        if (!order)
          throw new BadRequestException(Message.PURCHASE_REQUIRED_FOR_REVIEW);
        const [review] = await this.reviews.create([{ ...input, authorId, verifiedPurchase: true }], {
          session,
        });
        await this.recalculate(
          input.group,
          shapeIntoMongoObjectId(input.targetId),
          session,
        );
        return review;
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new BadRequestException(Message.ALREADY_REVIEWED);
      throw error;
    }
  }
  async list(
    group: ReviewGroup,
    targetId: Types.ObjectId,
    input: PageInquiry,
    admin = false,
  ) {
    facet(input);
    return (
      await this.reviews.aggregate([
        {
          $match: {
            group,
            targetId,
            ...(!admin ? { status: ContentStatus.ACTIVE } : {}),
          },
        },
        { $addFields: { likeCount: { $ifNull: ["$likeCount", 0] } } },
        { $sort: { createdAt: input.oldest ? 1 : -1, _id: -1 } },
        { $facet: {
          list: [{ $skip: ((input.page || 1) - 1) * (input.limit || 20) }, { $limit: input.limit || 20 },
            { $lookup: { from: 'members', localField: 'authorId', foreignField: '_id', as: 'author', pipeline: [{ $project: { memberNick: 1, memberImage: 1 } }] } },
            { $addFields: { authorNick: { $arrayElemAt: ['$author.memberNick', 0] }, authorImage: { $arrayElemAt: ['$author.memberImage', 0] } } },
            { $project: { author: 0 } }],
          metaCounter: [{ $count: 'total' }],
          ratingBreakdown: [{ $group: { _id: '$rating', count: { $sum: 1 } } }, { $project: { _id: 0, rating: '$_id', count: 1 } }]
        } },
      ])
    )[0];
  }
  async like(actor: Member, id: Types.ObjectId) {
    if (!actor?._id) throw new ForbiddenException("FORBIDDEN");
    return atomic(this.connection, async (session) => {
      if (
        !(await this.reviews
          .findOne({ _id: id, status: ContentStatus.ACTIVE })
          .session(session))
      )
        throw new NotFoundException("REVIEW_NOT_FOUND");
      const delta = await this.likes.toggleLike(
        {
          memberId: shapeIntoMongoObjectId(actor._id),
          likeGroup: LikeGroup.REVIEW,
          likeRefId: id,
        },
        session,
      );
      return this.reviews.findByIdAndUpdate(
        id,
        { $inc: { likeCount: delta } },
        { new: true, session },
      );
    });
  }
  async reply(actor: Member, id: Types.ObjectId, text: string) {
    if (!actor?._id) throw new ForbiddenException("FORBIDDEN");
    const review = await this.reviews.findOne({ _id: id, status: ContentStatus.ACTIVE });
    if (!review) throw new NotFoundException("REVIEW_NOT_FOUND");
    const ownsProduct = review.group === ReviewGroup.PRODUCT && await this.products.exists({ _id: review.targetId, productSellerId: actor._id });
    if (actor.memberType !== MemberType.ADMIN && !(actor.memberType === MemberType.SELLER && ownsProduct))
      throw new ForbiddenException("FORBIDDEN");
    if (!text.trim() || text.length > 3000)
      throw new BadRequestException("INVALID_REPLY");
    const result = await this.reviews.findOneAndUpdate(
      { _id: id, status: ContentStatus.ACTIVE },
      {
        $set: {
          adminReply: text.trim(),
          replyAuthorId: actor._id,
          replyRole: actor.memberType,
          replyAt: new Date(),
        },
      },
      { new: true },
    );
    if (!result) throw new NotFoundException("REVIEW_NOT_FOUND");
    return result;
  }
  async sellerTop(sellerId: Types.ObjectId) {
    const rows = await this.reviews.aggregate([
      { $match: { group: ReviewGroup.PRODUCT, status: ContentStatus.ACTIVE } },
      {
        $lookup: {
          from: "products",
          localField: "targetId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $match: { "product.productSellerId": sellerId } },
      {
        $lookup: {
          from: "orders",
          let: { oid: "$orderId", pid: "$targetId", uid: "$authorId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$oid"] },
                    { $eq: ["$memberId", "$$uid"] },
                    { $eq: ["$paymentStatus", "PAID"] },
                    { $eq: ["$status", "DELIVERED"] },
                  ],
                },
              },
            },
            { $unwind: "$items" },
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$items.productId", "$$pid"] },
                    { $eq: ["$items.status", "DELIVERED"] },
                  ],
                },
              },
            },
          ],
          as: "purchase",
        },
      },
      { $match: { "purchase.0": { $exists: true } } },
      { $addFields: { likeCount: { $ifNull: ["$likeCount", 0] } } },
      { $sort: { likeCount: -1, createdAt: -1, _id: 1 } },
      { $limit: 3 },
      { $lookup: { from: 'members', localField: 'authorId', foreignField: '_id', as: 'author', pipeline: [{ $project: { memberNick: 1, memberImage: 1 } }] } },
      { $addFields: { authorNick: { $arrayElemAt: ['$author.memberNick', 0] }, authorImage: { $arrayElemAt: ['$author.memberImage', 0] } } },
      { $unset: ["product", "purchase", "author"] },
    ]);
    return { list: rows, metaCounter: [{ total: rows.length }] };
  }
  async remove(id: Types.ObjectId) {
    return atomic(this.connection, async (session) => {
      const result = await this.reviews.findByIdAndUpdate(
        id,
        { $set: { status: ContentStatus.DELETE } },
        { new: true, session },
      );
      if (!result) throw new NotFoundException("REVIEW_NOT_FOUND");
      await this.recalculate(
        result.group,
        shapeIntoMongoObjectId(result.targetId),
        session,
      );
      return result;
    });
  }
}
