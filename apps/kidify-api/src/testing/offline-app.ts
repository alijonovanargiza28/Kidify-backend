import { Global, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { createConnection } from 'mongoose';
import { AppModule } from '../app.module';
import { DatabaseModule } from '../database/database.module';
@Global()
@Module({
	providers: [{ provide: getConnectionToken(), useFactory: () => createConnection() }],
	exports: [getConnectionToken()],
})
class OfflineDatabaseModule {}
// Compile the real application and schema with disconnected models. No .env DB is contacted.
export async function createOfflineApp() {
	process.env.SECRET_TOKEN ??= 'offline-schema-verification-only-secret';
	const module = await Test.createTestingModule({ imports: [AppModule] })
		.overrideModule(DatabaseModule)
		.useModule(OfflineDatabaseModule)
		.compile();
	const app = module.createNestApplication();
	app.useGlobalPipes(new ValidationPipe({ transform: true }));
	await app.init();
	return app;
}
