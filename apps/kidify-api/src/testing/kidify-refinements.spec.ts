import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { Types } from "mongoose";
import { ageRange, activeSale } from "../components/product/product.rules";
import {
  productPrice,
  presentProduct,
  productMatch,
  ProductService,
} from "../components/product/product.service";
import { SupportInput } from "../components/support/support";
import { SupportService } from "../components/support/support.service";
import { ReviewService } from "../components/review/review.service";
import { MemberService } from "../components/member/member.service";
import { KidifyBatchService } from "../../../kidify-batch/src/kidify-batch.service";
import { MemberType, MemberStatus } from "../libs/enums/member.enum";
import { FAQCategory } from "../libs/enums/marketplace.enum";

describe("Kidify final refinements", () => {
  it("uses real supported numeric intervals including compatible M/Y ranges", () => {
    expect(ageRange({ size: "0-6M" })).toEqual([0, 6]);
    expect(ageRange({ size: "1-2Y" })).toEqual([12, 24]);
    expect(ageRange({ size: "XS" })).toBeUndefined();
    expect(
      ageRange({ size: "0-6M", ageMinMonths: 5, ageMaxMonths: 5 }),
    ).toEqual([5, 5]);
  });
  it("expires discounts at the exact backend boundary in display and checkout pricing", () => {
    const p: any = {
      productPrice: 100,
      productDiscount: 20,
      saleStart: new Date("2026-01-01"),
      saleEnd: new Date("2026-01-02"),
      createdAt: new Date(),
      productSales: 0,
      productVariants: [],
    };
    expect(activeSale(p, +new Date("2026-01-01"))).toBe(true);
    expect(activeSale(p, +new Date("2026-01-02"))).toBe(false);
    expect(productPrice(p)).toBe(100);
    expect(presentProduct(p).badges).not.toContain("SALE");
    expect(presentProduct(p).productOldPrice).toBeUndefined();
  });
  it("uses one matching variant for color and numeric month, not separate array matches", () => {
    const match: any = productMatch({
      page: 1,
      limit: 12,
      search: { color: "Pink", ageMonth: 5 },
    } as any);
    expect(match.productVariants.$elemMatch.ageMinMonths).toEqual({ $lte: 5 });
    expect(match.productVariants.$elemMatch.ageMaxMonths).toEqual({ $gte: 5 });
    expect(match.productVariants.$elemMatch.color.$options).toBe("i");
  });
  it("rejects overlapping stock ranges and unrelated variant image paths", async () => {
    const service = Object.create(ProductService.prototype);
    const input: any = {
      productName: "Cotton sleepsuit",
      productImages: ["a.jpg"],
      productVariants: [
        { color: "Pink", ageMinMonths: 0, ageMaxMonths: 6, stock: 4 },
        { color: "Pink", ageMinMonths: 5, ageMaxMonths: 8, stock: 2 },
      ],
    };
    await expect(service.validateInput(input)).rejects.toThrow(
      "OVERLAPPING_AGE_VARIANTS",
    );
    input.productVariants = [
      { color: "Pink", stock: 3, images: ["unrelated.jpg"] },
    ];
    await expect(service.validateInput(input)).rejects.toThrow(
      "INVALID_VARIANT_IMAGES",
    );
  });
  it("reproduces optional order input validation failure and accepts corrected payload", async () => {
    const payload = {
      subject: "Delivery question",
      message: "Please confirm the planned delivery date.",
      category: Object.values(FAQCategory)[0],
    };
    const errors = await validate(
      plainToInstance(SupportInput, {
        ...payload,
        relatedOrderId: "my-order-number",
      }),
    );
    expect(errors.some((e) => e.property === "relatedOrderId")).toBe(true);
    expect(await validate(plainToInstance(SupportInput, payload))).toEqual([]);
  });
  it("rejects another member’s related order independently of the UI", async () => {
    const model: any = { create: jest.fn() },
      orders: any = { exists: jest.fn().mockResolvedValue(false) },
      svc = new SupportService(model, {} as any, orders);
    await expect(
      svc.create(new Types.ObjectId(), {
        subject: "A",
        message: "B",
        category: Object.values(FAQCategory)[0],
        relatedOrderId: String(new Types.ObjectId()),
      }),
    ).rejects.toThrow("ORDER_NOT_FOUND");
    expect(model.create).not.toHaveBeenCalled();
  });
  it("blocks review likes and replies without an authenticated actor id", async () => {
    const svc = Object.create(ReviewService.prototype),
      id = new Types.ObjectId();
    for (const role of [MemberType.USER, MemberType.SELLER, MemberType.CS]) {
      await expect(svc.like({ memberType: role }, id)).rejects.toThrow(
        "FORBIDDEN",
      );
      await expect(
        svc.reply({ memberType: role }, id, "hello"),
      ).rejects.toThrow("FORBIDDEN");
    }
  });
  it("blocks own admin deletion before issuing a DB update", async () => {
    const svc = Object.create(MemberService.prototype),
      id = new Types.ObjectId();
    await expect(
      svc.updateMemberByAdmin(
        { _id: id, memberStatus: MemberStatus.DELETE },
        id,
      ),
    ).rejects.toThrow("CANNOT_DISABLE_OWN_ADMIN");
  });
  it("wishlist thresholds use deduplicated keys, skip non-wishlisted users and allow a new stock event", async () => {
    const now = new Date("2026-10-07T00:00:00Z"),
      pid = new Types.ObjectId(),
      uid = new Types.ObjectId(),
      iid = new Types.ObjectId();
    const p: any = {
      _id: pid,
      productSellerId: new Types.ObjectId(),
      productVariants: [{ stock: 1 }],
      productDiscount: 10,
      saleStart: new Date(+now - 1000),
      saleEnd: new Date(+now + 23 * 3600000),
    };
    let active = false,
      event = 0,
      interested = true;
    const records = new Map<string, any>();
    const cursor = (values: any[]) => ({
      async *[Symbol.asyncIterator]() {
        yield* values;
      },
    });
    const products: any = {
      find: () => ({ lean: () => ({ cursor: () => cursor([p]) }) }),
      updateOne: async (filter: any) => {
        if (filter.lowStockActive === true) {
          active = false;
        } else if (!active) {
          active = true;
          event++;
        }
      },
      findById: () => ({
        select: () => ({ lean: async () => ({ lowStockEvent: event }) }),
      }),
    };
    const likes: any = {
      find: () => ({
        select: () => ({
          lean: () => ({ cursor: () => cursor([{ _id: iid, memberId: uid }]) }),
        }),
      }),
      exists: async () => interested,
    };
    const notifications: any = {
      updateOne: async (_f: any, u: any) => {
        const n = u.$setOnInsert;
        records.set(String(n._id), n);
      },
    };
    const svc = new KidifyBatchService(
      likes,
      notifications,
      products,
      {} as any,
    );
    await svc.batchWishlistAlerts(now);
    await svc.batchWishlistAlerts(now);
    expect(records.size).toBe(2);
    await svc.batchWishlistAlerts(new Date(+now + 12 * 3600000));
    expect(records.size).toBe(3);
    p.productVariants[0].stock = 3;
    await svc.batchWishlistAlerts(now);
    p.productVariants[0].stock = 1;
    await svc.batchWishlistAlerts(now);
    expect(records.size).toBe(4);
    interested = false;
    records.clear();
    await svc.batchWishlistAlerts(now);
    expect(records.size).toBe(0);
  });
});
