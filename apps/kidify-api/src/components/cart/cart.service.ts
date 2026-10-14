import { Message } from "../../libs/enums/common.enum";
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Cart, CartItemInput } from "./cart";
import { Product } from "../product/product";
import { Member } from "../../libs/dto/member/member";
import { ProductStatus } from "../../libs/enums/product.enum";
import { ageRange } from "../product/product.rules";
import {
  ProductService,
  productPrice,
  presentProduct,
} from "../product/product.service";
import { LikeService } from "../like/like.service";
import { LikeGroup } from "../../libs/enums/like.enum";
import { money } from "../../libs/marketplace";
import { shapeIntoMongoObjectId } from "../../libs/config";
@Injectable()
export class CartService {
  constructor(
    @InjectModel("Cart") private readonly model: Model<Cart>,
    @InjectModel("Product") private readonly products: Model<Product>,
    @InjectModel("Member") private readonly members: Model<Member>,
    private readonly productService: ProductService,
    private readonly likes: LikeService,
  ) {}
  async raw(memberId: Types.ObjectId) {
    return this.model
      .findOneAndUpdate(
        { memberId },
        { $setOnInsert: { memberId, items: [] } },
        { upsert: true, new: true },
      )
      .lean();
  }
  async get(memberId: Types.ObjectId): Promise<Cart> {
    const cart = (await this.raw(memberId))!;
    const products = await this.products
      .find({ _id: { $in: cart.items.map((i) => i.productId) } })
      .lean();
    const sellers = await this.members
      .find({
        _id: { $in: products.map((p) => p.productSellerId) },
        memberStatus: "ACTIVE",
        memberType: "SELLER",
      })
      .select("_id")
      .lean();
    const activeSellers = new Set(sellers.map((s) => String(s._id)));
    let subtotal = 0;
    const items = cart.items.map((item) => {
      const product = products.find(
        (p) => String(p._id) === String(item.productId),
      );
      const variant = product?.productVariants.find(
        (v) => String(v._id) === String(item.variantId),
      );
      const available =
        !!product &&
        product.productStatus === ProductStatus.ACTIVE &&
        activeSellers.has(String(product.productSellerId)) &&
        !!variant &&
        variant.stock >= item.quantity;
      const unitPrice = product ? productPrice(product) : undefined;
      const lineTotal =
        unitPrice === undefined ? undefined : money(unitPrice * item.quantity);
      if (available) subtotal = money(subtotal + (lineTotal ?? 0));
      return {
        ...item,
        available,
        unitPrice,
        lineTotal,
        product:
          product && product.productStatus !== ProductStatus.DELETE
            ? presentProduct(product)
            : undefined,
      };
    });
    return { ...cart, items, subtotal };
  }
  async add(memberId: Types.ObjectId, input: CartItemInput) {
    for (let retry = 0; retry < 4; retry++) {
      const cart = (await this.raw(memberId))!;
      const checked = await this.productService.validateCartProduct(
        shapeIntoMongoObjectId(input.productId),
        input.variantId,
        input.quantity,
      );
      const range = ageRange(checked.variant);
      if (
        range &&
        (input.ageMonth == null ||
          input.ageMonth < range[0] ||
          input.ageMonth > range[1])
      )
        throw new BadRequestException("SELECT_SUPPORTED_MONTH");
      if (!range && input.ageMonth != null)
        throw new BadRequestException("INVALID_AGE_MONTH");
      const found = cart.items.find(
        (i) =>
          String(i.productId) === input.productId &&
          String(i.variantId) === String(checked.variant._id) &&
          i.ageMonth === input.ageMonth,
      );
      const quantity = input.quantity + (found?.quantity ?? 0);
      const reserved = cart.items
        .filter((i) => String(i.variantId) === String(checked.variant._id))
        .reduce((n, i) => n + i.quantity, 0);
      if (reserved + input.quantity > checked.variant.stock || quantity > 1000)
        throw new BadRequestException(Message.INSUFFICIENT_STOCK);
      if (!found && cart.items.length >= 100)
        throw new BadRequestException("CART_LIMIT");
      const items = found
        ? cart.items.map((i) =>
            String(i._id) === String(found._id) ? { ...i, quantity } : i,
          )
        : [
            ...cart.items,
            {
              _id: new Types.ObjectId(),
              productId: checked.product._id,
              variantId: checked.variant._id,
              color: checked.variant.color,
              size:
                input.ageMonth != null
                  ? `${input.ageMonth}M`
                  : checked.variant.size,
              ageMonth: input.ageMonth,
              quantity,
            },
          ];
      const result = await this.model.updateOne(
        { _id: cart._id, __v: (cart as Cart & { __v: number }).__v },
        { $set: { items }, $inc: { __v: 1 } },
      );
      if (result.modifiedCount) return this.get(memberId);
    }
    throw new BadRequestException("CART_CHANGED_RETRY");
  }
  async update(
    memberId: Types.ObjectId,
    itemId: Types.ObjectId,
    quantity: number,
  ) {
    const cart = (await this.raw(memberId))!;
    const item = cart.items.find((i) => String(i._id) === String(itemId));
    if (!item) throw new NotFoundException("CART_ITEM_NOT_FOUND");
    const checked = await this.productService.validateCartProduct(
      shapeIntoMongoObjectId(item.productId),
      String(item.variantId),
      quantity,
    );
    const other = cart.items
      .filter(
        (i) =>
          String(i.variantId) === String(item.variantId) &&
          String(i._id) !== String(itemId),
      )
      .reduce((n, i) => n + i.quantity, 0);
    if (other + quantity > checked.variant.stock)
      throw new BadRequestException(Message.INSUFFICIENT_STOCK);
    const result = await this.model.updateOne(
      {
        _id: cart._id,
        __v: (cart as Cart & { __v: number }).__v,
        "items._id": itemId,
      },
      { $set: { "items.$.quantity": quantity }, $inc: { __v: 1 } },
    );
    if (!result.modifiedCount)
      throw new BadRequestException("CART_CHANGED_RETRY");
    return this.get(memberId);
  }
  async remove(memberId: Types.ObjectId, itemId: Types.ObjectId) {
    await this.model.updateOne(
      { memberId },
      { $pull: { items: { _id: itemId } }, $inc: { __v: 1 } },
    );
    return this.get(memberId);
  }
  async clear(memberId: Types.ObjectId) {
    await this.model.updateOne(
      { memberId },
      { $set: { items: [] }, $inc: { __v: 1 } },
    );
    return this.get(memberId);
  }
  async favoriteToCart(memberId: Types.ObjectId, input: CartItemInput) {
    const like = {
      memberId,
      likeRefId: shapeIntoMongoObjectId(input.productId),
      likeGroup: LikeGroup.PRODUCT,
    };
    if (!(await this.likes.checkLikeExistence(like)).length)
      throw new NotFoundException("FAVORITE_NOT_FOUND");
    const cart = await this.add(memberId, input);
    if (await this.likes.removeLike(like))
      await this.products.updateOne(
        { _id: input.productId },
        { $inc: { productFavorites: -1, productRank: -2 } },
      );
    return cart;
  }
  async cartToFavorite(memberId: Types.ObjectId, itemId: Types.ObjectId) {
    const cart = (await this.raw(memberId))!;
    const item = cart.items.find((i) => String(i._id) === String(itemId));
    if (!item) throw new NotFoundException("CART_ITEM_NOT_FOUND");
    const like = {
      memberId,
      likeRefId: shapeIntoMongoObjectId(item.productId),
      likeGroup: LikeGroup.PRODUCT,
    };
    if (!(await this.likes.checkLikeExistence(like)).length)
      await this.productService.favorite(memberId, like.likeRefId);
    return this.remove(memberId, itemId);
  }
}
