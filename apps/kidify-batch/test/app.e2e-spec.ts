import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { KidifyBatchController } from './../src/kidify-batch.controller';
import { KidifyBatchService } from './../src/kidify-batch.service';

describe('KidifyBatchController (e2e)', () => {
	let app: INestApplication;

	beforeEach(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			controllers: [KidifyBatchController],
			providers: [
				{ provide: KidifyBatchService, useValue: { getHello: () => 'Welcome to Kidify BATCH Server' } },
			],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
	});

	it('/ (GET)', () => {
		return request(app.getHttpServer()).get('/').expect(200).expect('Welcome to Kidify BATCH Server');
	});
});
