import { AssistantSearch, validateAssistantSearch } from './assistant-search';
import { Message } from "../../libs/enums/common.enum";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";
import { ClientSession, Model, PipelineStage, Types } from "mongoose";
import { Order } from "../order/order";
import {
  Product,
  ProductInput,
  ProductUpdate,
  ProductsInquiry,
} from "./product";
import { ProductStatus, ProductSort } from "../../libs/enums/product.enum";
import { Member } from "../../libs/dto/member/member";
import { MemberStatus, MemberType } from "../../libs/enums/member.enum";
import { Brand } from "../brand/brand";
import { ContentStatus } from "../../libs/enums/marketplace.enum";
import { atomic, facet, escapeSearch, money } from "../../libs/marketplace";
import {
  shapeIntoMongoObjectId,
  lookupAuthMemberLiked,
} from "../../libs/config";
import { ViewService } from "../view/view.service";
import { LikeService } from "../like/like.service";
import { ViewGroup } from "../../libs/enums/view.enum";
import { LikeGroup } from "../../libs/enums/like.enum";
import { NotificationService } from "../notification/notification.service";
import {
  NotificationType,
  NotificationGroup,
} from "../../libs/enums/notification.enum";
import {
  activeSale,
  ageRange,
  priceExpression,
  saleExpression,
  variantAgeProjection,
} from "./product.rules";
export function productPrice(
  product: Pick<
    Product,
    "productPrice" | "productDiscount" | "saleStart" | "saleEnd"
  >,
) {
  return money(
    (product.productPrice *
      (100 - (activeSale(product) ? (product.productDiscount ?? 0) : 0))) /
      100,
  );
}
export function presentProduct(product: Product): Product {
  const value = {
    ...product,
    productVariants: (product.productVariants || []).map((v) => {
      const range = ageRange(v);
      return {
        ...v,
        ...(range ? { ageMinMonths: range[0], ageMaxMonths: range[1] } : {}),
      };
    }),
    finalPrice: productPrice(product),
    badges: [] as string[],
  };
  if (Date.now() - new Date(product.createdAt).getTime() < 14 * 86400000)
    value.badges.push("NEW");
  if (activeSale(product)) {
    value.badges.push("SALE");
    value.productOldPrice = product.productPrice;
  }
  if (product.productSales >= 10) value.badges.push("BEST SELLER");
  if (product.productRank >= 50) value.badges.push("TRENDING");
  return value;
}
export function productMatch(
  input: ProductsInquiry,
  admin = false,
): Record<string, unknown> {
  const search = input.search ?? {};
 const ageFrom=search.ageFromMonths ?? search.ageMonth;
 const ageTo=search.ageToMonths ?? search.ageMonth;
 if((ageFrom==null)!==(ageTo==null)||ageFrom!=null&&ageTo!=null&&ageFrom>ageTo)throw new BadRequestException('INVALID_AGE_RANGE');
  const match: Record<string, unknown> = {
    productStatus: admin
      ? (search.status ?? { $ne: ProductStatus.DELETE })
      : { $in: [ProductStatus.ACTIVE, ProductStatus.SOLD_OUT] },
  };
  if (!admin && search.status) {
    if (![ProductStatus.ACTIVE, ProductStatus.SOLD_OUT].includes(search.status))
      throw new ForbiddenException("PRIVATE_PRODUCT_STATUS");
    match.productStatus = search.status;
  }
  for (const [key, field] of [
    ["category", "productCategory"],
    ["type", "productType"],
    ["collection", "productCollection"],
  ] as const)
    if (search[key]) match[field] = search[key];
  if (search.brandId)
    match.productBrandId = shapeIntoMongoObjectId(search.brandId);
  if (search.sellerId)
    match.productSellerId = shapeIntoMongoObjectId(search.sellerId);
  if (search.text)
    match.productName = { $regex: escapeSearch(search.text), $options: "i" };
  if (search.discount !== undefined) {
    if (
      !Number.isInteger(search.discount) ||
      search.discount < 0 ||
      search.discount > 100
    )
      throw new BadRequestException("INVALID_DISCOUNT");
    match.productDiscount = search.discount;
  }
  if (search.saleOnly)
    match.productDiscount = {
      $gt: 0,
      ...(search.discount !== undefined ? { $eq: search.discount } : {}),
    };
  if (search.color || search.size || ageFrom != null)
    match.productVariants = {
      $elemMatch: {
        ...(search.color
          ? {
              color: {
                $regex: "^" + escapeSearch(search.color) + "$",
                $options: "i",
              },
            }
          : {}),
        ...(search.size ? { size: search.size } : {}),
        ...(ageFrom != null
          ? {
              ageMinMonths: { $lte: ageTo },
              ageMaxMonths: { $gte: ageFrom },
            }
          : {}),
      },
    };
  if (search.minPrice !== undefined || search.maxPrice !== undefined) {
    if (
      (search.minPrice ?? 0) < 0 ||
      (search.maxPrice ?? Infinity) < (search.minPrice ?? 0)
    )
      throw new BadRequestException("INVALID_PRICE_RANGE");
    const actualPrice = priceExpression();
    match.$expr = {
      $and: [
        ...(search.minPrice !== undefined
          ? [{ $gte: [actualPrice, search.minPrice] }]
          : []),
        ...(search.maxPrice !== undefined
          ? [{ $lte: [actualPrice, search.maxPrice] }]
          : []),
      ],
    };
  }
  if (search.saleOnly || (search.discount ?? 0) > 0)
    match.$and = [{ $expr: saleExpression() }];
  return match;
}
@Injectable()
export class ProductService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel("Order") private readonly orders: Model<Order>,
    @InjectModel("Product") private readonly model: Model<Product>,
    @InjectModel("Member") private readonly members: Model<Member>,
    @InjectModel("Brand") private readonly brands: Model<Brand>,
    private readonly views: ViewService,
    private readonly likes: LikeService,
    private readonly notifications: NotificationService,
  ) {}
  async validateInput(input: ProductInput) {
    input.productName = input.productName.trim();
    if (!input.productName)
      throw new BadRequestException("PRODUCT_NAME_REQUIRED");
    if (
      Boolean(input.saleStart) !== Boolean(input.saleEnd) ||
      (input.saleStart &&
        +new Date(input.saleStart) >= +new Date(input.saleEnd!))
    )
      throw new BadRequestException("INVALID_SALE_PERIOD");
    for (const v of input.productVariants || []) {
      const range = ageRange(v);
      if (
        (v.ageMinMonths == null) !== (v.ageMaxMonths == null) ||
        (range && (range[0] > range[1] || range[1] > 240))
      )
        throw new BadRequestException("INVALID_AGE_RANGE");
      if (range) {
        v.ageMinMonths = range[0];
        v.ageMaxMonths = range[1];
      }
      if (v.images?.some((src) => !input.productImages.includes(src)))
        throw new BadRequestException("INVALID_VARIANT_IMAGES");
    }
    for (let i = 0; i < (input.productVariants || []).length; i++)
      for (let j = 0; j < i; j++) {
        const a = input.productVariants[i],
          b = input.productVariants[j],
          ar = ageRange(a),
          br = ageRange(b);
        if (
          (a.color || "").toLowerCase() === (b.color || "").toLowerCase() &&
          ar &&
          br &&
          ar[0] <= br[1] &&
          br[0] <= ar[1]
        )
          throw new BadRequestException("OVERLAPPING_AGE_VARIANTS");
      }
    if (!input.productVariants?.length || input.productVariants.length > 100)
      throw new BadRequestException(Message.INVALID_VARIANT);
    const keys = input.productVariants.map((v) =>
      JSON.stringify([
        (v.color ?? "").toLowerCase(),
        v.ageMinMonths ?? v.size ?? "",
        v.ageMaxMonths ?? "",
      ]),
    );
    if (
      new Set(keys).size !== keys.length ||
      input.productVariants.some(
        (v) => !Number.isInteger(v.stock) || v.stock < 0,
      )
    )
      throw new BadRequestException(Message.INVALID_VARIANT);
    if (
      input.productBrandId &&
      !(await this.brands.exists({
        _id: input.productBrandId,
        brandStatus: ContentStatus.ACTIVE,
      }))
    )
      throw new BadRequestException("INVALID_BRAND");
  }
  async create(sellerId: Types.ObjectId, input: ProductInput) {
    await this.validateInput(input);
    if (!input.productVariants.some((v) => v.stock > 0))
      throw new BadRequestException(Message.INSUFFICIENT_STOCK);
    if (
      !(await this.members.exists({
        _id: sellerId,
        memberType: MemberType.SELLER,
        memberStatus: MemberStatus.ACTIVE,
      }))
    )
      throw new ForbiddenException(Message.FORBIDDEN);
    return atomic(this.connection, async (session) => {
      const [product] = await this.model.create(
        [
          {
            ...input,
            productSellerId: sellerId,
            productStatus: ProductStatus.ACTIVE,
          },
        ],
        { session },
      );
      const counted = await this.members.updateOne(
        {
          _id: sellerId,
          memberStatus: MemberStatus.ACTIVE,
          memberType: MemberType.SELLER,
        },
        { $inc: { memberProducts: 1 } },
        { session },
      );
      if (!counted.modifiedCount)
        throw new ForbiddenException(Message.FORBIDDEN);
      return presentProduct(product.toObject());
    });
  }
  async update(actor: Member, input: ProductUpdate) {
    await this.validateInput(input);
    const existing = await this.model
      .findOne({
        _id: input._id,
        ...(actor.memberType === MemberType.ADMIN
          ? {}
          : { productSellerId: actor._id }),
        productStatus: { $ne: ProductStatus.DELETE },
      })
      .lean();
    if (!existing) throw new NotFoundException("PRODUCT_NOT_FOUND");
    const { _id, ...data } = input;
    // Keep identity for unchanged variants so carts/orders keep valid references.
    const variants = data.productVariants.map((v) => ({
      ...v,
      _id:
        existing.productVariants.find(
          (old) =>
            (old.color ?? "") === (v.color ?? "") &&
            (old.size ?? "") === (v.size ?? "") &&
            (ageRange(old)?.join("-") ?? "") === (ageRange(v)?.join("-") ?? ""),
        )?._id ?? new Types.ObjectId(),
    }));
    const kept = new Set(variants.map((v) => String(v._id)));
    const removed = existing.productVariants
      .filter((v) => !kept.has(String(v._id)))
      .map((v) => shapeIntoMongoObjectId(v._id));
    if (
      removed.length &&
      (await this.orders.exists({
        status: { $nin: ["DELIVERED", "CANCELLED", "REFUNDED"] },
        items: {
          $elemMatch: { productId: existing._id, variantId: { $in: removed } },
        },
      }))
    )
      throw new BadRequestException("VARIANT_HAS_OPEN_ORDERS");
    const stock = variants.reduce((n, v) => n + v.stock, 0);
    const status =
      existing.productStatus === ProductStatus.PAUSE
        ? ProductStatus.PAUSE
        : stock
          ? ProductStatus.ACTIVE
          : ProductStatus.SOLD_OUT;
    const revision = (existing as Product & { __v: number }).__v;
    const product = await this.model
      .findOneAndUpdate(
        { _id, __v: revision, productStatus: { $ne: ProductStatus.DELETE } },
        {
          $set: { ...data, productVariants: variants, productStatus: status },
          $inc: { __v: 1 },
        },
        { new: true, runValidators: true },
      )
      .lean();
    if (!product) throw new BadRequestException("PRODUCT_CHANGED_RETRY");
    return presentProduct(product);
  }
  async status(
    actor: Member,
    productId: Types.ObjectId,
    status: ProductStatus,
  ) {
    if (
      ![
        ProductStatus.PAUSE,
        ProductStatus.ACTIVE,
        ProductStatus.DELETE,
      ].includes(status)
    )
      throw new BadRequestException("INVALID_PRODUCT_STATUS");
    return atomic(this.connection, async (session) => {
      const product = await this.model
        .findOne({
          _id: productId,
          ...(actor.memberType === MemberType.ADMIN
            ? {}
            : { productSellerId: actor._id }),
          productStatus: { $ne: ProductStatus.DELETE },
        })
        .session(session);
      if (!product) throw new NotFoundException("PRODUCT_NOT_FOUND");
      if (actor.memberType !== MemberType.ADMIN && product.get("adminPaused"))
        throw new ForbiddenException("ADMIN_REACTIVATION_REQUIRED");
      if (
        status === ProductStatus.ACTIVE &&
        !product.productVariants.some((v) => v.stock > 0)
      )
        throw new BadRequestException(Message.INSUFFICIENT_STOCK);
      const changed = await this.model
        .findOneAndUpdate(
          { _id: productId, __v: product.get("__v") },
          {
            $set: {
              productStatus: status,
              ...(actor.memberType === MemberType.ADMIN
                ? { adminPaused: status === ProductStatus.PAUSE }
                : {}),
              ...(status === ProductStatus.DELETE
                ? { deletedAt: new Date() }
                : {}),
            },
            $inc: { __v: 1 },
          },
          { new: true, session },
        )
        .lean();
      if (!changed) throw new BadRequestException("PRODUCT_CHANGED_RETRY");
      if (status === ProductStatus.DELETE)
        await this.members.updateOne(
          { _id: product.productSellerId },
          { $inc: { memberProducts: -1 } },
          { session },
        );
      return presentProduct(changed);
    });
  }
  async get(id: Types.ObjectId, memberId?: Types.ObjectId) {
    const product = await this.model
      .findOne({
        _id: id,
        productStatus: { $in: [ProductStatus.ACTIVE, ProductStatus.SOLD_OUT] },
      })
      .lean();
    if (
      !product ||
      !(await this.members.exists({
        _id: product.productSellerId,
        memberStatus: MemberStatus.ACTIVE,
        memberType: MemberType.SELLER,
      }))
    )
      throw new NotFoundException("PRODUCT_NOT_FOUND");
    if (memberId) {
      if (
        await this.views.recordView({
          memberId,
          viewGroup: ViewGroup.PRODUCT,
          viewRefId: id,
        })
      ) {
        await this.model.updateOne(
          { _id: id },
          { $inc: { productViews: 1, productRank: 1 } },
        );
        product.productViews++;
      }
      product.meLiked = await this.likes.checkLikeExistence({
        memberId,
        likeGroup: LikeGroup.PRODUCT,
        likeRefId: id,
      });
    }
    return presentProduct(product);
  }
  async list(
    input: ProductsInquiry,
    memberId?: Types.ObjectId,
    admin = false,
    exclude?: Types.ObjectId,
    assistant?: { brandIds?: Types.ObjectId[] },
  ) {
    const match = productMatch(input, admin);
    if (assistant) {
      match.productStatus = ProductStatus.ACTIVE;
      match.deletedAt = null;
      match.adminPaused = { $ne: true };
      const variant = (match.productVariants as any)?.$elemMatch ?? {};
      match.productVariants = { $elemMatch: { ...variant, stock: { $gt: 0 } } };
      if (assistant.brandIds) match.productBrandId = { $in: assistant.brandIds };
    }
    if (exclude) match._id = { $ne: exclude };
    const sort: Record<ProductSort, Record<string, 1 | -1>> = {
      NEWEST: { createdAt: -1 },
      PRICE_LOW_TO_HIGH: { finalPrice: 1 },
      PRICE_HIGH_TO_LOW: { finalPrice: -1 },
      MOST_VIEWED: { productViews: -1 },
      MOST_FAVORITED: { productFavorites: -1 },
      BEST_SELLING: { productSales: -1 },
      TRENDING: { productFavorites: -1 },
      DISCOUNT: { effectiveDiscount: -1 },
    };
    const pipeline: PipelineStage[] = [
      ...((input.search?.ageMonth != null || input.search?.ageFromMonths != null || input.search?.ageToMonths != null)
        ? [
            {
              $addFields: { productVariants: variantAgeProjection },
            } as PipelineStage,
          ]
        : []),
      { $match: match },
      {
        $addFields: {
          finalPrice: priceExpression(),
          effectiveDiscount: {
            $cond: [saleExpression(), { $ifNull: ["$productDiscount", 0] }, 0],
          },
        },
      },
    ];
    if (!admin)
      pipeline.push(
        {
          $lookup: {
            from: "members",
            localField: "productSellerId",
            foreignField: "_id",
            as: "seller",
          },
        },
        {
          $match: {
            "seller.memberStatus": MemberStatus.ACTIVE,
            "seller.memberType": MemberType.SELLER,
          },
        },
        { $unset: "seller" },
      );
    pipeline.push(
      { $sort: { ...sort[input.sort ?? ProductSort.NEWEST], _id: -1 } },
      facet(input, memberId ? [lookupAuthMemberLiked(memberId)] : []),
    );
    const result = (await this.model.aggregate(pipeline))[0];
    result.list = result.list.map(presentProduct);
    return result;
  }
  /** Public, purchasable catalog only. Tool callers cannot supply database operators or visibility flags. */
  async searchForAssistant(filters: AssistantSearch) {
    const safe = validateAssistantSearch(filters);
    const { brand, ...search } = safe;
    let brandIds: Types.ObjectId[] | undefined;
    if (brand) {
      const brands = await this.brands.find({ brandStatus: ContentStatus.ACTIVE, brandName: { $regex: escapeSearch(brand), $options: 'i' } }).select('_id').limit(20).lean();
      brandIds = brands.map(item => new Types.ObjectId(String(item._id)));
      if (!brandIds.length) return [];
    }
    const result = await this.list({ page: 1, limit: 6, oldest: false, sort: ProductSort.BEST_SELLING, search }, undefined, false, undefined, { brandIds });
    return result.list.map((product: Product) => ({
      _id: String(product._id), productName: product.productName, productImages: product.productImages,
      finalPrice: product.finalPrice, productStatus: product.productStatus, available: true,
      productVariants: product.productVariants.filter(v => v.stock > 0).map(v => ({ color: v.color, size: v.size, ageMinMonths: v.ageMinMonths, ageMaxMonths: v.ageMaxMonths, stock: v.stock })),
      deliveryReturnInfo: product.deliveryReturnInfo || null, material: product.material || null, careInstructions: product.careInstructions || null,
      detailPath: '/products/detail?id=' + String(product._id),
    }));
  }

  async today() {
    const now = new Date();
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tashkent",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const start = new Date(day + "T00:00:00+05:00"),
      end = new Date(+start + 86400000);
    const sales = await this.orders.aggregate([
      {
        $match: {
          paymentStatus: "PAID",
          status: { $nin: ["CANCELLED", "REFUNDED"] },
        },
      },
      {
        $lookup: {
          from: "payments",
          localField: "paymentId",
          foreignField: "_id",
          as: "paid",
        },
      },
      { $unwind: "$paid" },
      {
        $match: {
          "paid.status": "PAID",
          "paid.paidAt": { $gte: start, $lt: end },
        },
      },
      { $unwind: "$items" },
      { $match: { "items.status": { $nin: ["CANCELLED", "REFUNDED"] } } },
      {
        $group: {
          _id: "$items.productId",
          quantity: { $sum: "$items.quantity" },
        },
      },
      { $sort: { quantity: -1, _id: 1 } },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $match: { "product.productStatus": { $in: ["ACTIVE", "SOLD_OUT"] } } },
      {
        $lookup: {
          from: "members",
          localField: "product.productSellerId",
          foreignField: "_id",
          as: "seller",
        },
      },
      {
        $match: {
          "seller.memberStatus": "ACTIVE",
          "seller.memberType": "SELLER",
        },
      },
      { $limit: 6 },
    ]);
    return {
      list: sales.map((s) => presentProduct(s.product)),
      metaCounter: [{ total: sales.length }],
    };
  }
  async favorite(memberId: Types.ObjectId, productId: Types.ObjectId) {
    const product = await this.get(productId);
    return atomic(this.connection, async (session) => {
      const delta = await this.likes.toggleLike(
        { memberId, likeRefId: productId, likeGroup: LikeGroup.PRODUCT },
        session,
      );
      const updated = await this.model
        .findByIdAndUpdate(
          productId,
          { $inc: { productFavorites: delta, productRank: delta * 2 } },
          { new: true, session },
        )
        .lean();
      if (!updated) throw new NotFoundException("PRODUCT_NOT_FOUND");
      if (delta > 0)
        await this.notifications.send(
          product.productSellerId,
          memberId,
          NotificationType.LIKE,
          NotificationGroup.PRODUCT,
          productId,
          "Your product was favorited",
          session,
        );
      return presentProduct({ ...updated, meLiked: delta > 0 ? [{ memberId, likeRefId: productId, myFavorite: true }] : [] });
    });
  }

  async validateCartProduct(
    productId: Types.ObjectId,
    variantId: string | undefined,
    quantity: number,
    session?: ClientSession,
  ) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000)
      throw new BadRequestException("INVALID_QUANTITY");
    const product = await this.model
      .findOne({ _id: productId, productStatus: ProductStatus.ACTIVE })
      .session(session ?? null)
      .lean();
    if (!product) throw new BadRequestException(Message.INACTIVE_PRODUCT);
    if (
      !(await this.members
        .findOne({
          _id: product.productSellerId,
          memberStatus: MemberStatus.ACTIVE,
          memberType: MemberType.SELLER,
        })
        .session(session ?? null))
    )
      throw new BadRequestException(Message.BLOCKED_MEMBER);
    const variant = variantId
      ? product.productVariants.find((v) => String(v._id) === variantId)
      : product.productVariants.length === 1 &&
          !product.productVariants[0].color &&
          !product.productVariants[0].size
        ? product.productVariants[0]
        : undefined;
    if (!variant) throw new BadRequestException(Message.INVALID_VARIANT);
    if (variant.stock < quantity)
      throw new BadRequestException(Message.INSUFFICIENT_STOCK);
    return { product, variant };
  }
}
