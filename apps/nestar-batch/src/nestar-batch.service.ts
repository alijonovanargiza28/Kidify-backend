import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { createHash } from "crypto";
import { activeSale } from "../../nestar-api/src/components/product/product.rules";
import { Model, Types } from "mongoose";
import { Member } from "apps/nestar-api/src/libs/dto/member/member";
import { Product } from "apps/nestar-api/src/components/product/product";
@Injectable()
export class NestarBatchService {
  constructor(
    @InjectModel("like") private readonly likes: Model<any>,
    @InjectModel("Notification") private readonly notifications: Model<any>,
    @InjectModel("Product") private readonly products: Model<Product>,
    @InjectModel("Member") private readonly members: Model<Member>,
  ) {}
  async batchRollback(): Promise<void> {
    await this.products.updateMany(
      { productStatus: { $in: ["ACTIVE", "SOLD_OUT"] } },
      { $set: { productRank: 0 } },
    );
    await this.members.updateMany(
      { memberType: "SELLER", memberStatus: "ACTIVE" },
      { $set: { memberRank: 0 } },
    );
  }
  async batchTopProducts(): Promise<void> {
    await this.products.updateMany(
      { productStatus: { $in: ["ACTIVE", "SOLD_OUT"] } },
      [
        {
          $set: {
            productRank: {
              $add: [
                "$productViews",
                { $multiply: ["$productFavorites", 2] },
                { $multiply: ["$productSales", 5] },
              ],
            },
          },
        },
      ],
    );
  }
  async batchTopSellers(): Promise<void> {
    await this.members.updateMany(
      { memberType: "SELLER", memberStatus: "ACTIVE" },
      [
        {
          $set: {
            memberRank: {
              $add: [
                "$memberViews",
                { $multiply: ["$memberProducts", 5] },
                { $multiply: ["$memberArticles", 3] },
                { $multiply: ["$memberLikes", 2] },
                { $multiply: ["$memberFollowers", 2] },
                { $multiply: ["$memberSales", 5] },
              ],
            },
          },
        },
      ],
    );
  }
  async batchWishlistAlerts(now = new Date()): Promise<void> {
    const cursor = this.products
      .find({ productStatus: { $in: ["ACTIVE", "SOLD_OUT"] } })
      .lean()
      .cursor();
    for await (const p of cursor) {
      const stock = p.productVariants.reduce((n, v) => n + v.stock, 0);
      if (stock !== 1)
        await this.products.updateOne(
          { _id: p._id, lowStockActive: true },
          { $set: { lowStockActive: false } },
        );
      else
        await this.products.updateOne(
          { _id: p._id, lowStockActive: { $ne: true } },
          { $set: { lowStockActive: true }, $inc: { lowStockEvent: 1 } },
        );
      const events: Array<{ key: string; title: string }> = [];
      if (activeSale(p, +now) && p.saleEnd) {
        const remaining = +new Date(p.saleEnd) - +now;
        const saleKey =
          String(+new Date(p.saleStart || 0)) +
          ":" +
          String(+new Date(p.saleEnd)) +
          ":" +
          p.productDiscount;
        if (remaining <= 12 * 3600000)
          events.push({
            key: "sale12:" + saleKey,
            title: "Hurry! A wishlist sale ends in under 12 hours.",
          });
        else if (remaining <= 24 * 3600000)
          events.push({
            key: "sale24:" + saleKey,
            title: "A wishlist sale ends in about 24 hours.",
          });
      }
      if (stock === 1) {
        const current = await this.products
          .findById(p._id)
          .select("lowStockEvent")
          .lean();
        events.push({
          key: "stock1:" + ((current as any)?.lowStockEvent || 1),
          title:
            "Almost gone! Only 1 left across all variants of an item in your wishlist.",
        });
      }
      if (!events.length) continue;
      const interested = this.likes
        .find({ likeGroup: "PRODUCT", likeRefId: p._id })
        .select("memberId")
        .lean()
        .cursor();
      for await (const interest of interested)
        for (const event of events) {
          // Recheck current interest; deterministic identifier and unique key survive concurrent workers/retries.
          if (
            !(await this.likes.exists({
              _id: interest._id,
              likeGroup: "PRODUCT",
            }))
          )
            continue;
          const key = `${interest.memberId}:${p._id}:${event.key}`;
          const notification = {
            _id: new Types.ObjectId(
              createHash("sha256").update(key).digest("hex").slice(0, 24),
            ),
            dedupeKey: key,
            receiverId: interest.memberId,
            authorId: p.productSellerId,
            targetId: p._id,
            notificationType: "SYSTEM",
            notificationGroup: "PRODUCT",
            notificationStatus: "WAIT",
            notificationTitle: event.title,
          };
          try {
            await this.notifications.updateOne(
              { _id: notification._id },
              { $setOnInsert: notification },
              { upsert: true },
            );
          } catch (error) {
            if ((error as any).code !== 11000) throw error;
          }
        }
    }
  }
  getHello(): string {
    return "Welcome to DIANORA BABY BATCH Server";
  }
}
