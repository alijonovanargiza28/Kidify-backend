import { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model, Types, ClientSession } from 'mongoose';
import { createOfflineApp } from './offline-app';
import { MemberService } from '../components/member/member.service';
import { AuthService } from '../components/auth/auth.service';
import { Member } from '../libs/dto/member/member';
import { MemberType, MemberStatus } from '../libs/enums/member.enum';
import { SellerCode, SellerCodeStatus } from '../components/seller-code/seller-code';
import { SellerCodeService } from '../components/seller-code/seller-code.service';
import { ReviewService } from '../components/review/review.service';
import { Review } from '../components/review/review';
import { ReviewGroup } from '../libs/enums/marketplace.enum';
import { Order } from '../components/order/order';
import { OrderService } from '../components/order/order.service';
import { ProductService } from '../components/product/product.service';
import { Product } from '../components/product/product';
import { ProductCategory, ProductType } from '../libs/enums/product.enum';
import { AddressService } from '../components/address/address.service';
import { Address } from '../components/address/address';
const id = new Types.ObjectId();
const signup = { memberNick: 'tester', memberPhone: '555123456', memberPassword: 'pass12345' };
describe('Authentication, ownership and purchase rules', () => {
	let app: INestApplication;
	beforeAll(async () => {
		app = await createOfflineApp();
	}, 20000);
	afterEach(() => jest.restoreAllMocks());
	afterAll(async () => {
		if (app) {
			await app.get<Connection>(getConnectionToken()).destroy();
			await app.close();
		}
	});
	function transaction() {
		const session = {
			withTransaction: async (operation: () => Promise<unknown>) => operation(),
			endSession: jest.fn(),
		};
		jest
			.spyOn(app.get<Connection>(getConnectionToken()), 'startSession')
			.mockResolvedValue(session as unknown as ClientSession);
		return session as unknown as ClientSession;
	}
	it.each([MemberType.USER, MemberType.SELLER, MemberType.ADMIN, MemberType.CS])(
		'public memberType %s cannot elevate signup',
		async (role) => {
			const model = app.get<Model<Member>>(getModelToken('Member'));
			const doc = new model({ ...signup, memberType: MemberType.USER });
			const create = jest.spyOn(model, 'create').mockResolvedValue(doc as never);
			const response = await app.get(MemberService).signup({ ...signup, memberType: role });
			const stored = create.mock.calls[0][0] as unknown as Member;
			expect(stored.memberType).toBe(MemberType.USER);
			expect(stored.memberPassword).not.toBe(signup.memberPassword);
			expect(await app.get(AuthService).comparePassword(signup.memberPassword, stored.memberPassword!)).toBe(true);
			expect(response.accessToken).toBeTruthy();
			expect(response.memberPassword).toBeUndefined();
		},
	);
	it('valid seller registration creates SELLER and consumes the code in the same session', async () => {
		const session = transaction();
		const model = app.get<Model<Member>>(getModelToken('Member'));
		const doc = new model({ ...signup, memberType: MemberType.SELLER });
		const create = jest.spyOn(model, 'create').mockResolvedValue([doc] as never);
		const consume = jest.spyOn(app.get(SellerCodeService), 'consume').mockResolvedValue(undefined);
		expect(
			(await app.get(MemberService).signup({ ...signup, memberType: MemberType.ADMIN, sellerCode: 'seller-code' }))
				.memberType,
		).toBe(MemberType.SELLER);
		expect(consume).toHaveBeenCalledWith('seller-code', doc._id, session);
		expect(create.mock.calls[0][1]).toEqual({ session });
	});
	it('failed Member creation never consumes the seller code', async () => {
		transaction();
		jest.spyOn(app.get<Model<Member>>(getModelToken('Member')), 'create').mockRejectedValue({ code: 11000 });
		const consume = jest.spyOn(app.get(SellerCodeService), 'consume').mockResolvedValue(undefined);
		await expect(app.get(MemberService).signup({ ...signup, sellerCode: 'seller-code' })).rejects.toThrow(
			'Already used',
		);
		expect(consume).not.toHaveBeenCalled();
	});
	it.each([SellerCodeStatus.USED, SellerCodeStatus.EXPIRED, SellerCodeStatus.REVOKED])(
		'rejects %s seller codes',
		async (status) => {
			const model = app.get<Model<SellerCode>>(getModelToken('SellerCode'));
			jest
				.spyOn(model, 'findOne')
				.mockReturnValue({ session: async () => ({ _id: id, status }) } as unknown as ReturnType<
					Model<SellerCode>['findOne']
				>);
			await expect(app.get(SellerCodeService).consume('code', id, {} as ClientSession)).rejects.toThrow(
				`SELLER_CODE_${status}`,
			);
		},
	);
	it('rejects nonexistent and expired ACTIVE codes', async () => {
		const model = app.get<Model<SellerCode>>(getModelToken('SellerCode'));
		const find = jest.spyOn(model, 'findOne');
		find.mockReturnValue({ session: async () => null } as unknown as ReturnType<Model<SellerCode>['findOne']>);
		await expect(app.get(SellerCodeService).consume('code', id, {} as ClientSession)).rejects.toThrow(
			'INVALID_SELLER_CODE',
		);
		find.mockReturnValue({
			session: async () => ({ _id: id, status: SellerCodeStatus.ACTIVE, expiresAt: new Date(0) }),
		} as unknown as ReturnType<Model<SellerCode>['findOne']>);
		await expect(app.get(SellerCodeService).consume('code', id, {} as ClientSession)).rejects.toThrow(
			'SELLER_CODE_EXPIRED',
		);
	});
	it('consumes ACTIVE codes with a conditional update and correct owner', async () => {
		const model = app.get<Model<SellerCode>>(getModelToken('SellerCode'));
		jest
			.spyOn(model, 'findOne')
			.mockReturnValue({ session: async () => ({ _id: id, status: SellerCodeStatus.ACTIVE }) } as unknown as ReturnType<
				Model<SellerCode>['findOne']
			>);
		const update = jest.spyOn(model, 'findOneAndUpdate').mockResolvedValue({ _id: id } as never);
		const session = {} as ClientSession;
		await app.get(SellerCodeService).consume('code', id, session);
		expect(update).toHaveBeenCalledWith(
			{ _id: id, status: SellerCodeStatus.ACTIVE },
			{ $set: { status: SellerCodeStatus.USED, usedBy: id, usedAt: expect.any(Date) } },
			{ new: true, session },
		);
	});
	it.each([null, { memberStatus: MemberStatus.DELETE }, { memberStatus: MemberStatus.BLOCK }])(
		'rejects absent/deleted/blocked login accounts',
		async (response) => {
			jest
				.spyOn(app.get<Model<Member>>(getModelToken('Member')), 'findOne')
				.mockReturnValue({ select: () => ({ exec: async () => response }) } as unknown as ReturnType<
					Model<Member>['findOne']
				>);
			await expect(app.get(MemberService).login(signup)).rejects.toThrow();
		},
	);
	it('wrong passwords are rejected', async () => {
		const hashed = await app.get(AuthService).hashPassword('wrong-value');
		jest
			.spyOn(app.get<Model<Member>>(getModelToken('Member')), 'findOne')
			.mockReturnValue({
				select: () => ({ exec: async () => ({ memberStatus: MemberStatus.ACTIVE, memberPassword: hashed }) }),
			} as unknown as ReturnType<Model<Member>['findOne']>);
		await expect(app.get(MemberService).login(signup)).rejects.toThrow('Wrong password');
	});
	it('product reviews require a DELIVERED paid purchase owned by the author', async () => {
		transaction();
		const find = jest
			.spyOn(app.get<Model<Order>>(getModelToken('Order')), 'findOne')
			.mockReturnValue({ session: async () => null } as unknown as ReturnType<Model<Order>['findOne']>);
		const create = jest.spyOn(app.get<Model<Review>>(getModelToken('Review')), 'create');
		await expect(
			app
				.get(ReviewService)
				.create(id, {
					group: ReviewGroup.PRODUCT,
					targetId: id.toHexString(),
					orderId: id.toHexString(),
					rating: 5,
					text: 'Great',
				}),
		).rejects.toThrow('PURCHASE_REQUIRED_FOR_REVIEW');
		expect(find.mock.calls[0][0]).toMatchObject({
			memberId: id,
			status: 'DELIVERED',
			paymentStatus: 'PAID',
			items: { $elemMatch: { productId: id, status: 'DELIVERED' } },
		});
		expect(create).not.toHaveBeenCalled();
	});
	it('seller cannot update another seller product', async () => {
		const model = app.get<Model<Product>>(getModelToken('Product'));
		const find = jest
			.spyOn(model, 'findOne')
			.mockReturnValue({ lean: async () => null } as unknown as ReturnType<Model<Product>['findOne']>);
		const update = jest.spyOn(model, 'findOneAndUpdate');
		await expect(
			app
				.get(ProductService)
				.update({ _id: id.toHexString(), memberType: MemberType.SELLER } as Member, {
					_id: id.toHexString(),
					productName: 'Book',
					productPrice: 10,
					productType: ProductType.BOOKS,
					productCategory: ProductCategory.BOOKS,
					productImages: ['image'],
					productVariants: [{ stock: 1 }],
				}),
		).rejects.toThrow('PRODUCT_NOT_FOUND');
		expect(find.mock.calls[0][0]).toMatchObject({ productSellerId: id.toHexString() });
		expect(update).not.toHaveBeenCalled();
	});
	it('private orders are filtered by JWT owner', async () => {
		const find = jest
			.spyOn(app.get<Model<Order>>(getModelToken('Order')), 'findOne')
			.mockReturnValue({ lean: async () => null } as unknown as ReturnType<Model<Order>['findOne']>);
		await expect(
			app.get(OrderService).get({ _id: id.toHexString(), memberType: MemberType.USER } as Member, new Types.ObjectId()),
		).rejects.toThrow('ORDER_NOT_FOUND');
		expect(find.mock.calls[0][0]).toMatchObject({ memberId: id.toHexString() });
	});
	it('address updates are filtered by JWT owner', async () => {
		transaction();
		const update = jest
			.spyOn(app.get<Model<Address>>(getModelToken('Address')), 'findOneAndUpdate')
			.mockResolvedValue(null);
		await expect(
			app
				.get(AddressService)
				.update(id, id, { recipientName: 'Name', phone: '123', region: 'Region', city: 'City', street: 'Street' }),
		).rejects.toThrow('ADDRESS_NOT_FOUND');
		expect(update.mock.calls[0][0]).toMatchObject({ memberId: id });
	});
});
