import { Message } from "../../libs/enums/common.enum";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { ClientSession, Connection, Model, Types } from "mongoose";
import { CheckoutInput, Order, OrderItem, OrdersInquiry } from "./order";
import { Cart } from "../cart/cart";
import { Product } from "../product/product";
import { Address } from "../address/address";
import { Payment } from "../payment/payment";
import { Delivery } from "../delivery/delivery";
import { Coupon } from "../coupon/coupon";
import { Member } from "../../libs/dto/member/member";
import { MemberType } from "../../libs/enums/member.enum";
import { OrderStatus, PaymentStatus } from "../../libs/enums/marketplace.enum";
import { ProductStatus } from "../../libs/enums/product.enum";
import { ProductService, productPrice } from "../product/product.service";
import { CouponService } from "../coupon/coupon.service";
import { CartService } from "../cart/cart.service";
import { NotificationService } from "../notification/notification.service";
import {
  NotificationType,
  NotificationGroup,
} from "../../libs/enums/notification.enum";
import { atomic, facet, money } from "../../libs/marketplace";
import { shapeIntoMongoObjectId } from "../../libs/config";
export const preparationNext: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: OrderStatus.CONFIRMED,
  CONFIRMED: OrderStatus.PREPARING,
  PREPARING: OrderStatus.READY_FOR_DELIVERY,
  READY_FOR_DELIVERY: OrderStatus.SHIPPED,
  SHIPPED: OrderStatus.DELIVERED,
};
export function parentPreparation(
  items: Pick<OrderItem, "status">[],
): OrderStatus {
  const stages = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY_FOR_DELIVERY,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
  ];
  return stages[Math.min(...items.map((i) => stages.indexOf(i.status)))];
}
@Injectable()
export class OrderService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel("Order") private readonly orders: Model<Order>,
    @InjectModel("Cart") private readonly carts: Model<Cart>,
    @InjectModel("Product") private readonly products: Model<Product>,
    @InjectModel("Address") private readonly addresses: Model<Address>,
    @InjectModel("Payment") private readonly payments: Model<Payment>,
    @InjectModel("Delivery") private readonly deliveries: Model<Delivery>,
    @InjectModel("Member") private readonly members: Model<Member>,
    @InjectModel("Coupon") private readonly coupons: Model<Coupon>,
    private readonly productService: ProductService,
    private readonly couponService: CouponService,
    private readonly cartService: CartService,
    private readonly notifications: NotificationService,
  ) {}
  async checkout(
    memberId: Types.ObjectId,
    input: CheckoutInput,
  ): Promise<Order> {
    const existing = await this.orders
      .findOne({ memberId, requestId: input.requestId })
      .lean();
    if (existing) return existing;
    return atomic(this.connection, async (session) => {
      const repeated = await this.orders
        .findOne({ memberId, requestId: input.requestId })
        .session(session)
        .lean();
      if (repeated) return repeated;
      const cart = await this.carts
        .findOne({ memberId })
        .session(session)
        .lean();
      if (!cart?.items.length) throw new BadRequestException("EMPTY_CART");
      const requestedIds = input.cartItemIds == null ? null : new Set(input.cartItemIds);
      const selectedItems = requestedIds ? cart.items.filter(item => requestedIds.has(String(item._id))) : cart.items;
      if (!selectedItems.length) throw new BadRequestException("EMPTY_CART_SELECTION");
      if (requestedIds && (requestedIds.size !== input.cartItemIds!.length || selectedItems.length !== requestedIds.size))
        throw new BadRequestException("INVALID_CART_SELECTION");
      const address = await this.addresses
        .findOne({ _id: shapeIntoMongoObjectId(input.addressId), memberId })
        .session(session)
        .lean();
      if (!address) throw new NotFoundException("ADDRESS_NOT_FOUND");
      const shippingAddress = {
        recipientName: address.recipientName,
        phone: address.phone,
        region: address.region,
        city: address.city,
        district: address.district,
        street: address.street,
        postalCode: address.postalCode,
        instructions: address.instructions,
      };
      const items: OrderItem[] = [];
      let subtotal = 0,
        productDiscount = 0;
      for (const cartItem of selectedItems) {
        const { product, variant } =
          await this.productService.validateCartProduct(
            shapeIntoMongoObjectId(cartItem.productId),
            String(cartItem.variantId),
            cartItem.quantity,
            session,
          );
        const finalUnitPrice = productPrice(product),
          finalItemPrice = money(finalUnitPrice * cartItem.quantity);
        subtotal = money(subtotal + finalItemPrice);
        const discount = money(
          (product.productPrice - finalUnitPrice) * cartItem.quantity,
        );
        productDiscount = money(productDiscount + discount);
        items.push({
          _id: new Types.ObjectId().toHexString(),
          productId: String(product._id),
          sellerId: String(product.productSellerId),
          productName: product.productName,
          productImage: variant.images?.[0] || product.productImages[0],
          variantId: String(variant._id),
          color: variant.color,
          size: cartItem.size ?? variant.size,
          quantity: cartItem.quantity,
          unitPrice: product.productPrice,
          discount,
          finalUnitPrice,
          finalItemPrice,
          status: OrderStatus.PENDING,
        });
        const reserved = await this.products.updateOne(
          {
            _id: product._id,
            productStatus: ProductStatus.ACTIVE,
            productVariants: {
              $elemMatch: {
                _id: shapeIntoMongoObjectId(variant._id),
                stock: { $gte: cartItem.quantity },
              },
            },
          },
          { $inc: { "productVariants.$.stock": -cartItem.quantity, __v: 1 } },
          { session },
        );
        if (!reserved.modifiedCount)
          throw new BadRequestException(Message.INSUFFICIENT_STOCK);
        await this.products.updateOne(
          {
            _id: product._id,
            productStatus: ProductStatus.ACTIVE,
            productVariants: { $not: { $elemMatch: { stock: { $gt: 0 } } } },
          },
          { $set: { productStatus: ProductStatus.SOLD_OUT } },
          { session },
        );
      }
      const coupon = input.couponCode
        ? await this.couponService.apply(input.couponCode, subtotal, session)
        : undefined;
      const couponDiscount = coupon?.discount ?? 0;
      const configuredFee = Number(process.env.DELIVERY_FEE ?? 0);
      if (!Number.isFinite(configuredFee) || configuredFee < 0)
        throw new BadRequestException("INVALID_DELIVERY_CONFIGURATION");
      const deliveryFee = money(configuredFee),
        total = money(subtotal - couponDiscount + deliveryFee);
      const orderId = new Types.ObjectId(),
        paymentId = new Types.ObjectId(),
        deliveryId = new Types.ObjectId();
      const [order] = await this.orders.create(
        [
          {
            _id: orderId,
            memberId,
            requestId: input.requestId,
            items,
            shippingAddress,
            subtotal,
            productDiscount,
            couponDiscount,
            couponId: coupon?.coupon._id,
            deliveryFee,
            total,
            paymentId,
            deliveryId,
          },
        ],
        { session },
      );
      await this.payments.create(
        [{ _id: paymentId, orderId, memberId, amount: total }],
        { session },
      );
      await this.deliveries.create(
        [{ _id: deliveryId, orderId, shippingAddress }],
        { session },
      );
      const cleared = await this.carts.updateOne(
        { _id: cart._id, __v: (cart as Cart & { __v: number }).__v },
        { $set: { items: requestedIds ? cart.items.filter(item => !requestedIds.has(String(item._id))) : [] }, $inc: { __v: 1 } },
        { session },
      );
      if (!cleared.modifiedCount)
        throw new BadRequestException("CART_CHANGED_RETRY");
      await this.notifyOrder(
        order,
        memberId,
        NotificationType.ORDER,
        "Order created",
        session,
      );
      return order.toObject();
    });
  }
  async notifyOrder(
    order: Order,
    actor: string | Types.ObjectId,
    type: NotificationType,
    title: string,
    session: ClientSession,
  ) {
    const recipients = new Set([
      String(order.memberId),
      ...order.items.map((i) => String(i.sellerId)),
    ]);
    for (const receiver of recipients)
      await this.notifications.send(
        receiver,
        actor,
        type,
        NotificationGroup.ORDER,
        order._id,
        title,
        session,
      );
  }
  async get(actor: Member, id: Types.ObjectId) {
    // Seller APIs return a separate projection containing only their items.
    const match = {
      _id: id,
      ...(actor.memberType === MemberType.ADMIN ? {} : { memberId: actor._id }),
    };
    const order = await this.orders.findOne(match).lean();
    if (!order) throw new NotFoundException("ORDER_NOT_FOUND");
    return order;
  }
  async list(memberId: Types.ObjectId | undefined, input: OrdersInquiry) {
    return (
      await this.orders.aggregate([
        {
          $match: {
            ...(memberId ? { memberId } : {}),
            ...(input.status ? { status: input.status } : {}),
          },
        },
        { $sort: { createdAt: input.oldest ? 1 : -1, _id: -1 } },
        facet(input),
      ])
    )[0];
  }
  async sellerList(sellerId: Types.ObjectId, input: OrdersInquiry) {
    return (
      await this.orders.aggregate([
        {
          $match: {
            items: {
              $elemMatch: {
                sellerId,
                ...(input.status ? { status: input.status } : {}),
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            status: 1,
            paymentStatus: 1,
            createdAt: 1,
            items: {
              $filter: {
                input: "$items",
                as: "item",
                cond: { $eq: ["$$item.sellerId", sellerId] },
              },
            },
          },
        },
        { $sort: { createdAt: input.oldest ? 1 : -1, _id: -1 } },
        facet(input),
      ])
    )[0];
  }
  async prepare(
    sellerId: Types.ObjectId,
    orderId: Types.ObjectId,
    itemId: Types.ObjectId,
    status: OrderStatus,
  ) {
    return atomic(this.connection, async (session) => {
      const order = await this.orders
        .findOne({ _id: orderId, "items.sellerId": sellerId })
        .session(session);
      if (!order) throw new NotFoundException("ORDER_NOT_FOUND");
      const item = order.items.find(
        (i) =>
          String(i._id) === String(itemId) &&
          String(i.sellerId) === String(sellerId),
      );
      if (!item) throw new NotFoundException("ORDER_ITEM_NOT_FOUND");
      if (
        order.paymentStatus !== PaymentStatus.PAID ||
        preparationNext[item.status] !== status ||
        ![
          OrderStatus.CONFIRMED,
          OrderStatus.PREPARING,
          OrderStatus.READY_FOR_DELIVERY,
          OrderStatus.SHIPPED,
          OrderStatus.DELIVERED,
        ].includes(status)
      )
        throw new BadRequestException(Message.INVALID_ORDER_TRANSITION);
      // Delivery credits are applied once inside the same transition transaction.
      if (status === OrderStatus.DELIVERED) {
        await this.products.updateOne({ _id: item.productId }, { $inc: { productSales: item.quantity, productRank: item.quantity * 5 } }, { session });
        await this.members.updateOne({ _id: item.sellerId }, { $inc: { memberSales: item.quantity, memberRank: item.quantity * 5 } }, { session });
      }
      item.status = status;
      order.status = parentPreparation(order.items);
      await order.save({ session });
      await this.deliveries.updateOne(
        { orderId },
        { $set: { status: order.status } },
        { session },
      );
      await this.notifications.send(
        order.memberId,
        sellerId,
        NotificationType.ORDER,
        NotificationGroup.ORDER,
        order._id,
        `Order item ${status.toLowerCase().replace(/_/g, " ")}`,
        session,
      );
      return {
        _id: order._id,
        items: order.items.filter(
          (i) => String(i.sellerId) === String(sellerId),
        ),
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
      };
    });
  }
  async pay(memberId: Types.ObjectId, paymentId: Types.ObjectId, fail = false) {
    return atomic(this.connection, async (session) => {
      const payment = await this.payments
        .findOne({ _id: paymentId, memberId })
        .session(session);
      if (!payment) throw new NotFoundException("PAYMENT_NOT_FOUND");
      const order = await this.orders
        .findById(payment.orderId)
        .session(session);
      if (
        !order ||
        order.status !== OrderStatus.PENDING ||
        ![PaymentStatus.PENDING, PaymentStatus.FAILED].includes(payment.status)
      )
        throw new BadRequestException(Message.INVALID_PAYMENT_ACTION);
      payment.status = fail ? PaymentStatus.FAILED : PaymentStatus.PAID;
      if (!fail) payment.paidAt = new Date();
      order.paymentStatus = payment.status;
      if (!fail) {
        order.status = OrderStatus.CONFIRMED;
        order.items.forEach((i) => (i.status = OrderStatus.CONFIRMED));
      }
      await payment.save({ session });
      await order.save({ session });
      await this.deliveries.updateOne(
        { orderId: order._id },
        { $set: { status: order.status } },
        { session },
      );
      await this.notifyOrder(
        order,
        memberId,
        NotificationType.ORDER,
        fail ? "Payment failed" : "Demo payment received",
        session,
      );
      return payment.toObject();
    });
  }
  async cancel(actor: Member, orderId: Types.ObjectId) {
    return atomic(this.connection, async (session) => {
      const order = await this.orders
        .findOne({
          _id: orderId,
          ...(actor.memberType === MemberType.ADMIN
            ? {}
            : { memberId: actor._id }),
        })
        .session(session);
      if (!order) throw new NotFoundException("ORDER_NOT_FOUND");
      const allowed =
        actor.memberType === MemberType.ADMIN
          ? [
              OrderStatus.PENDING,
              OrderStatus.CONFIRMED,
              OrderStatus.PREPARING,
              OrderStatus.READY_FOR_DELIVERY,
            ]
          : [OrderStatus.PENDING, OrderStatus.CONFIRMED];
      if (
        !allowed.includes(order.status) ||
        order.items.some(i => [OrderStatus.SHIPPED, OrderStatus.DELIVERED].includes(i.status)) ||
        (actor.memberType !== MemberType.ADMIN &&
          order.items.some(
            (i) =>
              ![OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(i.status),
          ))
      )
        throw new BadRequestException(Message.INVALID_ORDER_TRANSITION);
      for (const item of order.items) {
        await this.products.updateOne(
          { _id: item.productId, "productVariants._id": item.variantId },
          { $inc: { "productVariants.$.stock": item.quantity, __v: 1 } },
          { session },
        );
        await this.products.updateOne(
          {
            _id: item.productId,
            productStatus: ProductStatus.SOLD_OUT,
            "productVariants.stock": { $gt: 0 },
          },
          { $set: { productStatus: ProductStatus.ACTIVE } },
          { session },
        );
        item.status = OrderStatus.CANCELLED;
      }
      order.status = OrderStatus.CANCELLED;
      order.paymentStatus =
        order.paymentStatus === PaymentStatus.PAID
          ? PaymentStatus.REFUNDED
          : PaymentStatus.CANCELLED;
      await order.save({ session });
      await this.payments.updateOne(
        { orderId },
        { $set: { status: order.paymentStatus } },
        { session },
      );
      await this.deliveries.updateOne(
        { orderId },
        { $set: { status: OrderStatus.CANCELLED } },
        { session },
      );
      if (order.couponId)
        await this.coupons.updateOne(
          { _id: order.couponId, usedCount: { $gt: 0 } },
          { $inc: { usedCount: -1 } },
          { session },
        );
      await this.notifyOrder(
        order,
        actor._id,
        NotificationType.ORDER,
        "Order cancelled",
        session,
      );
      return order.toObject();
    });
  }
  async delivery(
    actor: Member,
    orderId: Types.ObjectId,
    status: OrderStatus,
    trackingCode?: string,
  ) {
    if (![MemberType.ADMIN, MemberType.CS].includes(actor.memberType))
      throw new ForbiddenException(Message.FORBIDDEN);
    return atomic(this.connection, async (session) => {
      const order = await this.orders.findById(orderId).session(session);
      if (!order) throw new NotFoundException("ORDER_NOT_FOUND");
      const valid =
        order.paymentStatus === PaymentStatus.PAID &&
        ((status === OrderStatus.SHIPPED &&
          order.items.every(
            (i) => i.status === OrderStatus.READY_FOR_DELIVERY,
          )) ||
          (status === OrderStatus.DELIVERED &&
            order.status === OrderStatus.SHIPPED));
      if (!valid)
        throw new BadRequestException(Message.INVALID_ORDER_TRANSITION);
      const newlyDelivered = order.items.filter(i => i.status !== OrderStatus.DELIVERED);
      order.status = status;
      order.items.forEach((i) => (i.status = status));
      await order.save({ session });
      const delivery = await this.deliveries.findOneAndUpdate(
        { orderId },
        {
          $set: {
            status,
            ...(trackingCode ? { trackingCode } : {}),
            ...(status === OrderStatus.SHIPPED
              ? { shippedAt: new Date() }
              : { deliveredAt: new Date() }),
          },
        },
        { new: true, session },
      );
      if (status === OrderStatus.DELIVERED)
        for (const item of newlyDelivered) {
          await this.products.updateOne(
            { _id: item.productId },
            {
              $inc: {
                productSales: item.quantity,
                productRank: item.quantity * 5,
              },
            },
            { session },
          );
          await this.members.updateOne(
            { _id: item.sellerId },
            {
              $inc: {
                memberSales: item.quantity,
                memberRank: item.quantity * 5,
              },
            },
            { session },
          );
        }
      await this.notifyOrder(
        order,
        actor._id,
        NotificationType.DELIVERY,
        status === OrderStatus.SHIPPED ? "Order shipped" : "Order delivered",
        session,
      );
      return delivery;
    });
  }
  async adminStatus(
    actor: Member,
    orderId: Types.ObjectId,
    status: OrderStatus,
  ) {
    if (actor.memberType !== MemberType.ADMIN)
      throw new ForbiddenException(Message.FORBIDDEN);
    if (status === OrderStatus.CANCELLED) return this.cancel(actor, orderId);
    if ([OrderStatus.SHIPPED, OrderStatus.DELIVERED].includes(status)) {
      await this.delivery(actor, orderId, status);
      return this.get(actor, orderId);
    }
    return atomic(this.connection, async (session) => {
      const order = await this.orders.findById(orderId).session(session);
      if (!order) throw new NotFoundException("ORDER_NOT_FOUND");
      if (status === OrderStatus.REFUNDED) {
        if (
          order.status !== OrderStatus.DELIVERED ||
          order.paymentStatus !== PaymentStatus.PAID
        )
          throw new BadRequestException(Message.INVALID_ORDER_TRANSITION);
        order.paymentStatus = PaymentStatus.REFUNDED;
        await this.payments.updateOne(
          { orderId },
          { $set: { status: PaymentStatus.REFUNDED } },
          { session },
        );
        for (const item of order.items) {
          await this.products.updateOne(
            { _id: item.productId, "productVariants._id": item.variantId },
            { $inc: { "productVariants.$.stock": item.quantity, __v: 1 } }, { session });
          await this.products.updateOne(
            { _id: item.productId, productStatus: ProductStatus.SOLD_OUT, "productVariants.stock": { $gt: 0 } },
            { $set: { productStatus: ProductStatus.ACTIVE } }, { session });

          await this.products.updateOne(
            { _id: item.productId },
            {
              $inc: {
                productSales: -item.quantity,
                productRank: -item.quantity * 5,
              },
            },
            { session },
          );
          await this.members.updateOne(
            { _id: item.sellerId },
            {
              $inc: {
                memberSales: -item.quantity,
                memberRank: -item.quantity * 5,
              },
            },
            { session },
          );
        }
      } else if (
        order.paymentStatus !== PaymentStatus.PAID ||
        preparationNext[order.status] !== status ||
        !order.items.every((i) => i.status === order.status)
      )
        throw new BadRequestException(Message.INVALID_ORDER_TRANSITION);
      order.status = status;
      order.items.forEach((i) => (i.status = status));
      await order.save({ session });
      await this.deliveries.updateOne(
        { orderId },
        { $set: { status } },
        { session },
      );
      await this.notifyOrder(
        order,
        actor._id,
        NotificationType.ORDER,
        `Order ${status.toLowerCase()}`,
        session,
      );
      return order.toObject();
    });
  }
  async buyAgain(memberId: Types.ObjectId, orderId: Types.ObjectId) {
    const order = await this.orders.findOne({ _id: orderId, memberId }).lean();
    if (!order) throw new NotFoundException("ORDER_NOT_FOUND");
    for (const item of order.items)
      await this.productService.validateCartProduct(
        shapeIntoMongoObjectId(item.productId),
        String(item.variantId),
        item.quantity,
      );
    for (const item of order.items)
      await this.cartService.add(memberId, {
        productId: String(item.productId),
        variantId: String(item.variantId),
        quantity: item.quantity,
        ...(/^\d+M$/.test(item.size || "")
          ? { ageMonth: Number(item.size!.slice(0, -1)) }
          : {}),
      });
    return this.cartService.get(memberId);
  }
  async paymentGet(actor: Member, id: Types.ObjectId) {
    const payment = await this.payments.findOne({
      _id: id,
      ...(actor.memberType === MemberType.ADMIN ? {} : { memberId: actor._id }),
    });
    if (!payment) throw new NotFoundException("PAYMENT_NOT_FOUND");
    return payment;
  }
  async deliveryGet(actor: Member, id: Types.ObjectId) {
    const delivery = await this.deliveries.findById(id);
    if (!delivery) throw new NotFoundException("DELIVERY_NOT_FOUND");
    if (![MemberType.ADMIN, MemberType.CS].includes(actor.memberType))
      await this.get(actor, shapeIntoMongoObjectId(delivery.orderId));
    return delivery;
  }
  async deliveryList(input: OrdersInquiry) {
    return (
      await this.deliveries.aggregate([
        { $match: input.status ? { status: input.status } : {} },
        { $sort: { createdAt: -1 } },
        facet(input),
      ])
    )[0];
  }
  async paymentList(input: OrdersInquiry) {
    return (
      await this.payments.aggregate([
        { $sort: { createdAt: -1 } },
        facet(input),
      ])
    )[0];
  }
}
