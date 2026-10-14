import { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Model, Connection, Types, ClientSession } from 'mongoose';
import { createOfflineApp } from './offline-app';
import { OrderService } from '../components/order/order.service';
import { Order } from '../components/order/order';
import { Cart } from '../components/cart/cart';
import { Address } from '../components/address/address';
import { Payment } from '../components/payment/payment';
import { Delivery } from '../components/delivery/delivery';
import { Product } from '../components/product/product';
import { ProductService } from '../components/product/product.service';
import { CouponService } from '../components/coupon/coupon.service';
import { Coupon } from '../components/coupon/coupon';
import { NotificationService } from '../components/notification/notification.service';
const buyer = new Types.ObjectId(),
	productA = new Types.ObjectId(),
	productB = new Types.ObjectId();
const sellerA = new Types.ObjectId(),
	sellerB = new Types.ObjectId(),
	variantA = new Types.ObjectId(),
	variantB = new Types.ObjectId();
describe('Checkout orchestration with transaction-scoped models', () => {
	let app: INestApplication, session: ClientSession;
	beforeAll(async () => {
		app = await createOfflineApp();
	}, 20000);
	afterAll(async () => {
		if (app) {
			await app.get<Connection>(getConnectionToken()).destroy();
			await app.close();
		}
	});
	afterEach(() => jest.restoreAllMocks());
	beforeEach(() => {
		session = {
			withTransaction: async (callback: () => Promise<unknown>) => callback(),
			endSession: jest.fn(),
		} as unknown as ClientSession;
		jest.spyOn(app.get<Connection>(getConnectionToken()), 'startSession').mockResolvedValue(session);
		const orders = app.get<Model<Order>>(getModelToken('Order'));
		jest
			.spyOn(orders, 'findOne')
			.mockReturnValue({ lean: async () => null, session: () => ({ lean: async () => null }) } as unknown as ReturnType<
				Model<Order>['findOne']
			>);
		jest
			.spyOn(orders, 'create')
			.mockImplementation((...args) => Promise.resolve([new orders((args[0] as unknown as object[])[0])]) as never);
		const cart = {
			_id: buyer,
			__v: 2,
			memberId: buyer,
			items: [
				{ _id: productA, productId: productA, variantId: variantA, quantity: 2 },
				{ _id: productB, productId: productB, variantId: variantB, quantity: 1 },
			],
		};
		jest
			.spyOn(app.get<Model<Cart>>(getModelToken('Cart')), 'findOne')
			.mockReturnValue({ session: () => ({ lean: async () => cart }) } as unknown as ReturnType<
				Model<Cart>['findOne']
			>);
		jest
			.spyOn(app.get<Model<Cart>>(getModelToken('Cart')), 'updateOne')
			.mockResolvedValue({ modifiedCount: 1 } as never);
		jest
			.spyOn(app.get<Model<Address>>(getModelToken('Address')), 'findOne')
			.mockReturnValue({
				session: () => ({
					lean: async () => ({
						recipientName: 'Buyer',
						phone: '555',
						region: 'Region',
						city: 'City',
						street: 'Street',
					}),
				}),
			} as unknown as ReturnType<Model<Address>['findOne']>);
		jest.spyOn(app.get(ProductService), 'validateCartProduct').mockImplementation(async (id) => ({
			product: {
				_id: String(id),
				productSellerId: String(id) === String(productA) ? sellerA.toHexString() : sellerB.toHexString(),
				productName: 'Original name',
				productImages: ['original-image'],
				productPrice: String(id) === String(productA) ? 100 : 50,
				productDiscount: String(id) === String(productA) ? 20 : 0,
			} as Product & { __v: number },
			variant: {
				_id: String(id) === String(productA) ? variantA.toHexString() : variantB.toHexString(),
				color: 'Pink',
				size: '3-6M',
				stock: 10,
			},
		}));
		jest
			.spyOn(app.get<Model<Product>>(getModelToken('Product')), 'updateOne')
			.mockResolvedValue({ modifiedCount: 1 } as never);
		jest.spyOn(app.get<Model<Payment>>(getModelToken('Payment')), 'create').mockResolvedValue([] as never);
		jest.spyOn(app.get<Model<Delivery>>(getModelToken('Delivery')), 'create').mockResolvedValue([] as never);
		jest.spyOn(app.get(NotificationService), 'send').mockResolvedValue(undefined);
		process.env.DELIVERY_FEE = '0';
	});
	it('creates one parent order with two sellers, snapshots and current backend prices', async () => {
		const couponId = new Types.ObjectId().toHexString();
		jest
			.spyOn(app.get(CouponService), 'apply')
			.mockResolvedValue({ coupon: { _id: couponId } as Coupon & { __v: number }, discount: 5, total: 205 });
		const order = await app
			.get(OrderService)
			.checkout(buyer, { addressId: buyer.toHexString(), requestId: 'test-checkout', couponCode: 'SAVE' });
		expect(order.items).toHaveLength(2);
		expect(order.items.map((i) => String(i.sellerId))).toEqual([sellerA.toHexString(), sellerB.toHexString()]);
		expect(order.items[0]).toMatchObject({
			productName: 'Original name',
			productImage: 'original-image',
			color: 'Pink',
			size: '3-6M',
			quantity: 2,
			unitPrice: 100,
			finalUnitPrice: 80,
			finalItemPrice: 160,
			discount: 40,
		});
		expect(order).toMatchObject({
			subtotal: 210,
			productDiscount: 40,
			couponDiscount: 5,
			deliveryFee: 0,
			total: 205,
			status: 'PENDING',
			paymentStatus: 'PENDING',
		});
		const create = app.get<Model<Order>>(getModelToken('Order')).create as jest.Mock;
		expect(create).toHaveBeenCalledTimes(1);
		expect(create.mock.calls[0][1]).toEqual({ session });
		expect(app.get<ProductService>(ProductService).validateCartProduct).toHaveBeenCalledWith(
			productA,
			variantA.toHexString(),
			2,
			session,
		);
		const clear = app.get<Model<Cart>>(getModelToken('Cart')).updateOne as jest.Mock;
		expect(clear.mock.calls[0][0]).toEqual({ _id: buyer, __v: 2 });
		expect(clear.mock.calls[0][2]).toEqual({ session });
	});

    it('charges and reserves only selected items, retaining unchecked cart rows', async () => {
        const order = await app.get(OrderService).checkout(buyer, {addressId: buyer.toHexString(), requestId:'selected-checkout',cartItemIds:[productB.toHexString()]});
        expect(order.items).toHaveLength(1);
        expect(String(order.items[0].productId)).toBe(productB.toHexString());
        expect(order.subtotal).toBe(50);expect(order.total).toBe(50);
        expect(app.get(ProductService).validateCartProduct).toHaveBeenCalledTimes(1);
        const update = app.get<Model<Cart>>(getModelToken('Cart')).updateOne as jest.Mock;
        expect(update.mock.calls[0][1].$set.items).toEqual([{_id:productA,productId:productA,variantId:variantA,quantity:2}]);
        const payment = app.get<Model<Payment>>(getModelToken('Payment')).create as jest.Mock;
        expect(payment.mock.calls[0][0][0].amount).toBe(50);
    });
    it.each([{cartItemIds:[]},{cartItemIds:[new Types.ObjectId().toHexString()]},{cartItemIds:[productA.toHexString(),productA.toHexString()]}])('rejects empty, foreign or duplicate selection before writes: %j', async ({cartItemIds}) => {
        await expect(app.get(OrderService).checkout(buyer,{addressId:buyer.toHexString(),requestId:'invalid-selection',cartItemIds})).rejects.toThrow();
        expect(app.get<Model<Order>>(getModelToken('Order')).create).not.toHaveBeenCalled();
        expect(app.get<Model<Cart>>(getModelToken('Cart')).updateOne).not.toHaveBeenCalled();
        expect(app.get(ProductService).validateCartProduct).not.toHaveBeenCalled();
    });
	it('insufficient stock rejects checkout before creating any order/payment or clearing the cart', async () => {
		jest.spyOn(app.get(ProductService), 'validateCartProduct').mockRejectedValue(new Error('INSUFFICIENT_STOCK'));
		await expect(
			app.get(OrderService).checkout(buyer, { addressId: buyer.toHexString(), requestId: 'stock-failure' }),
		).rejects.toThrow('INSUFFICIENT_STOCK');
		expect(app.get<Model<Order>>(getModelToken('Order')).create).not.toHaveBeenCalled();
		expect(app.get<Model<Payment>>(getModelToken('Payment')).create).not.toHaveBeenCalled();
		expect(app.get<Model<Cart>>(getModelToken('Cart')).updateOne).not.toHaveBeenCalled();
		expect(session.endSession).toHaveBeenCalledTimes(1);
	});
	it('conditional stock decrement prevents overselling', async () => {
		const updates = jest
			.spyOn(app.get<Model<Product>>(getModelToken('Product')), 'updateOne')
			.mockResolvedValue({ modifiedCount: 0 } as never);
		await expect(
			app.get(OrderService).checkout(buyer, { addressId: buyer.toHexString(), requestId: 'race-stock' }),
		).rejects.toThrow('INSUFFICIENT_STOCK');
		expect(updates.mock.calls[0][0]).toMatchObject({
			productVariants: { $elemMatch: { _id: variantA, stock: { $gte: 2 } } },
		});
		expect(app.get<Model<Order>>(getModelToken('Order')).create).not.toHaveBeenCalled();
	});
	it('stale cart version aborts checkout instead of silently clearing changed items', async () => {
		jest
			.spyOn(app.get<Model<Cart>>(getModelToken('Cart')), 'updateOne')
			.mockResolvedValue({ modifiedCount: 0 } as never);
		await expect(
			app.get(OrderService).checkout(buyer, { addressId: buyer.toHexString(), requestId: 'cart-race' }),
		).rejects.toThrow('CART_CHANGED_RETRY');
		expect(app.get(NotificationService).send).not.toHaveBeenCalled();
		expect(session.endSession).toHaveBeenCalledTimes(1);
	});
});
