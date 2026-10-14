import {
  productMatch,
  productPrice,
  presentProduct,
} from "../components/product/product.service";
import { ProductsInquiry, Product } from "../components/product/product";
import {
  ProductType,
  ProductCategory,
  ProductCollection,
  ProductStatus,
  ProductSort,
} from "../libs/enums/product.enum";
import { Coupon } from "../components/coupon/coupon";
import { couponDiscount } from "../components/coupon/coupon.service";
import {
  DiscountType,
  CouponStatus,
  OrderStatus,
} from "../libs/enums/marketplace.enum";
import {
  parentPreparation,
  preparationNext,
} from "../components/order/order.service";
import { atomic, facet } from "../libs/marketplace";
import { Types, Connection, ClientSession } from "mongoose";
import ProductSchema from "../schemas/Product.model";
import { model } from "mongoose";
const id = new Types.ObjectId().toHexString();
describe("Marketplace calculations and invariants", () => {
  it("combines collection, brand, seller, discount and size/color on the same variant", () => {
    const inquiry: ProductsInquiry = {
      page: 2,
      limit: 20,
      oldest: false,
      sort: ProductSort.NEWEST,
      search: {
        collection: ProductCollection.GIRLS,
        brandId: id,
        sellerId: id,
        discount: 20,
        size: "3-6M",
        color: "Pink",
        text: "baby.*",
        minPrice: 10,
        maxPrice: 50,
      },
    };
    const match = productMatch(inquiry);
    expect(match).toMatchObject({
      productCollection: "GIRLS",
      productDiscount: 20,
      productVariants: {
        $elemMatch: {
          color: { $regex: "^Pink$", $options: "i" },
          size: "3-6M",
        },
      },
      productName: { $regex: "baby\\.\\*", $options: "i" },
    });
    expect(String(match.productBrandId)).toBe(id);
    expect(match.$expr).toBeDefined();
  });
  it.each([20, 30, 40])(
    "supports exact %i percent discount filtering",
    (discount) => {
      expect(
        productMatch({ search: { discount } } as ProductsInquiry)
          .productDiscount,
      ).toBe(discount);
    },
  );
  it("sale-only sections exclude products with zero discount while retaining exact discount filters", () => {
    expect(
      productMatch({ search: { saleOnly: true } } as ProductsInquiry)
        .productDiscount,
    ).toEqual({ $gt: 0 });
    expect(
      productMatch({
        search: { saleOnly: true, discount: 20 },
      } as ProductsInquiry).productDiscount,
    ).toEqual({
      $gt: 0,
      $eq: 20,
    });
  });
  it("denies public DELETE/PAUSE filters", () => {
    expect(() =>
      productMatch({
        search: { status: ProductStatus.DELETE },
      } as ProductsInquiry),
    ).toThrow("PRIVATE_PRODUCT_STATUS");
  });
  it("uses server-side discounted prices and currency rounding", () => {
    expect(productPrice({ productPrice: 19.99, productDiscount: 20 })).toBe(
      15.99,
    );
  });
  it("never labels zero-sales products as best sellers", () => {
    const p = {
      productPrice: 20,
      productDiscount: 0,
      productSales: 0,
      productRank: 0,
      createdAt: new Date(),
    } as Product;
    expect(presentProduct(p).badges).toEqual(["NEW"]);
  });
  const coupon = {
    status: CouponStatus.ACTIVE,
    discountType: DiscountType.PERCENT,
    discountValue: 30,
    usedCount: 0,
  } as Coupon;
  it("caps coupon discounts and prevents negative order totals", () => {
    expect(couponDiscount({ ...coupon, maximumDiscount: 10 }, 100)).toBe(10);
    expect(
      couponDiscount(
        { ...coupon, discountType: DiscountType.FIXED, discountValue: 200 },
        100,
      ),
    ).toBe(100);
  });
  it.each([
    { status: CouponStatus.DISABLED },
    { usedCount: 1, usageLimit: 1 },
    { endAt: new Date(0) },
    { startAt: new Date(Date.now() + 86400000) },
    { minimumOrder: 200 },
  ])("rejects unusable coupons %j", (patch) => {
    expect(() => couponDiscount({ ...coupon, ...patch }, 100)).toThrow(
      "INVALID_COUPON",
    );
  });
  it("keeps a multi-seller parent below READY until every item is ready", () => {
    expect(
      parentPreparation([
        { status: OrderStatus.READY_FOR_DELIVERY },
        { status: OrderStatus.PREPARING },
      ]),
    ).toBe(OrderStatus.PREPARING);
    expect(
      parentPreparation([
        { status: OrderStatus.READY_FOR_DELIVERY },
        { status: OrderStatus.READY_FOR_DELIVERY },
      ]),
    ).toBe(OrderStatus.READY_FOR_DELIVERY);
    expect(preparationNext[OrderStatus.PREPARING]).toBe(
      OrderStatus.READY_FOR_DELIVERY,
    );
    expect(preparationNext[OrderStatus.DELIVERED]).toBeUndefined();
  });
  it("pagination stays bounded", () => {
    expect(facet({ page: 2, limit: 10, oldest: false })).toMatchObject({
      $facet: { list: [{ $skip: 10 }, { $limit: 10 }] },
    });
    expect(() => facet({ page: 1, limit: 101, oldest: false })).toThrow(
      "INVALID_PAGINATION",
    );
  });
  it("size-less/color-less variants remain valid and negative stock is invalid", () => {
    const ProductModel = model("TestProductSchema", ProductSchema);
    const data = {
      productName: "Baby book",
      productPrice: 10,
      productImages: ["uploads/product/book.png"],
      productType: ProductType.BOOKS,
      productCategory: ProductCategory.BOOKS,
      productSellerId: id,
      productVariants: [{ stock: 10 }],
    };
    expect(new ProductModel(data).validateSync()).toBeUndefined();
    expect(
      new ProductModel({
        ...data,
        productVariants: [{ stock: -1 }],
      }).validateSync(),
    ).toBeDefined();
  });
  it("transaction helper always ends its session on failure and fails closed on standalone MongoDB", async () => {
    const session = {
      withTransaction: jest
        .fn()
        .mockRejectedValue(
          new Error(
            "Transaction numbers are only allowed on a replica set member",
          ),
        ),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const connection = {
      startSession: async () => session,
    } as unknown as Connection;
    await expect(
      atomic(connection, async (_session: ClientSession) => 1),
    ).rejects.toThrow("MONGODB_REPLICA_SET_REQUIRED");
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });
});
