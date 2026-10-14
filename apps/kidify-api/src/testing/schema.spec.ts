import { GraphQLSchemaHost } from '@nestjs/graphql';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { validateSchema } from 'graphql';
import { createOfflineApp } from './offline-app';
describe('Full Kidify application and GraphQL schema', () => {
	let app: INestApplication;
	beforeAll(async () => {
		app = await createOfflineApp();
	}, 20000);
	afterAll(async () => {
		if (app) {
			await app.get<Connection>(getConnectionToken()).destroy();
			await app.close();
		}
	});
	it('initializes every module, resolver, guard and WebSocket dependency without contacting MongoDB', () => {
		const schema = app.get(GraphQLSchemaHost).schema;
		expect(validateSchema(schema)).toEqual([]);
		const queries = Object.keys(schema.getQueryType()!.getFields());
		const mutations = Object.keys(schema.getMutationType()!.getFields());
		expect(queries).toEqual(
			expect.arrayContaining([
				'getMe',
				'getSellers',
				'getProducts',
				'getBrands',
				'getMyCart',
				'getMyOrders',
				'getSellerOrders',
				'getAdminDashboard',
				'getSellerDashboard',
				'getReviews',
				'getMyNotifications',
				'getMyMessages',
				'getFAQs',
				'getEvents',
				'getMySupportTickets',
			]),
		);
		expect(mutations).toEqual(
			expect.arrayContaining([
				'signup',
				'createSellerCode',
				'createProduct',
				'addToCart',
				'createOrder',
				'payOrderDemo',
				'updateDeliveryStatus',
				'createReview',
				'sendMessage',
				'replySupportTicket',
			]),
		);
		expect(queries).not.toContain('getProperties');
		expect(schema.getType('Member')!.toString()).toBe('Member');
		expect((schema.getType('Member') as import('graphql').GraphQLObjectType).getFields()).not.toHaveProperty(
			'memberPassword',
		);
		for (const name of ['GiftRegistry', 'Reward', 'Eligibility', 'BirthdayReward'])
			expect(schema.getType(name)).toBeUndefined();
	});
});
