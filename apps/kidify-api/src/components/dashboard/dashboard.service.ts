import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product } from '../product/product';
import { Member } from '../../libs/dto/member/member';
import { Order } from '../order/order';
import { presentProduct } from '../product/product.service';
import { MemberService } from '../member/member.service';
import { OrderStatus, PaymentStatus } from '../../libs/enums/marketplace.enum';
@Injectable()
export class DashboardService {
	constructor(
		@InjectModel('Product') private readonly products: Model<Product>,
		@InjectModel('Member') private readonly members: Model<Member>,
		@InjectModel('Order') private readonly orders: Model<Order>,
		private readonly memberService: MemberService,
	) {}
	async admin() {
		const [memberCounts, productCounts, orderCounts, revenue, topProducts, topSellers, recentOrders] =
			await Promise.all([
				this.members.aggregate([
					{ $group: { _id: { type: '$memberType', status: '$memberStatus' }, count: { $sum: 1 } } },
				]),
				this.products.aggregate([{ $group: { _id: '$productStatus', count: { $sum: 1 } } }]),
				this.orders.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
				this.orders.aggregate([
					{ $match: { status: OrderStatus.DELIVERED, paymentStatus: PaymentStatus.PAID } },
					{ $group: { _id: null, total: { $sum: '$total' } } },
				]),
				this.products
					.find({ productStatus: { $in: ['ACTIVE', 'SOLD_OUT'] }, productSales: { $gt: 0 } })
					.sort({ productSales: -1, _id: -1 })
					.limit(10)
					.lean(),
				this.members
					.find({ memberType: 'SELLER', memberStatus: 'ACTIVE', memberSales: { $gt: 0 } })
					.sort({ memberSales: -1, _id: -1 })
					.limit(10)
					.lean(),
				this.orders.find().sort({ createdAt: -1 }).limit(10).lean(),
			]);
		const countMembers = (type: string, status?: string) =>
			memberCounts
				.filter((c) => c._id.type === type && (!status || c._id.status === status))
				.reduce((n, c) => n + c.count, 0);
		const countOrders = (status?: string) =>
			orderCounts.filter((c) => !status || c._id === status).reduce((n, c) => n + c.count, 0);
		return {
			totalUsers: countMembers('USER'),
			totalSellers: countMembers('SELLER'),
			activeSellers: countMembers('SELLER', 'ACTIVE'),
			blockedSellers: countMembers('SELLER', 'BLOCK'),
			totalProducts: productCounts.reduce((n, c) => n + c.count, 0),
			activeProducts: productCounts.find((c) => c._id === 'ACTIVE')?.count ?? 0,
			totalOrders: countOrders(),
			deliveredOrders: countOrders('DELIVERED'),
			pendingOrders: countOrders('PENDING'),
			revenue: revenue[0]?.total ?? 0,
			topProducts: topProducts.map(presentProduct),
			topSellers: topSellers.map((s) => this.memberService.publicMember(s)),
			recentOrders,
		};
	}
	async seller(sellerId: Types.ObjectId) {
		const [member, productCount, statistics] = await Promise.all([
			this.members.findById(sellerId).lean(),
			this.products.countDocuments({ productSellerId: sellerId, productStatus: { $ne: 'DELETE' } }),
			this.orders.aggregate([
				{ $match: { 'items.sellerId': sellerId, status: OrderStatus.DELIVERED, paymentStatus: PaymentStatus.PAID } },
				{ $unwind: '$items' },
				{ $match: { 'items.sellerId': sellerId } },
				{
					$group: {
						_id: null,
						salesCount: { $sum: '$items.quantity' },
						orderIds: { $addToSet: '$_id' },
						revenue: {
							$sum: {
								$subtract: [
									'$items.finalItemPrice',
									{
										$cond: [
											{ $gt: ['$subtotal', 0] },
											{ $multiply: ['$couponDiscount', { $divide: ['$items.finalItemPrice', '$subtotal'] }] },
											0,
										],
									},
								],
							},
						},
					},
				},
			]),
		]);
		return {
			productCount,
			salesCount: statistics[0]?.salesCount ?? 0,
			deliveredCount: statistics[0]?.orderIds.length ?? 0,
			revenue: statistics[0]?.revenue ?? 0,
			followers: member?.memberFollowers ?? 0,
			averageRating: member?.averageRating ?? 0,
			reviewCount: member?.memberReviews ?? 0,
		};
	}
}
