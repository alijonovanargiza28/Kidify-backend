import { authOrigins, refreshCookieOptions } from './components/auth/auth-http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MaxFileSizeValidator, ValidationPipe } from '@nestjs/common';
import { LoggingInterceptor } from './libs/enums/intersepter/loggingIntercepter';
import { graphqlUploadExpress } from 'graphql-upload';
import * as express from 'express';
import { WsAdapter } from '@nestjs/platform-ws';
import { join } from 'path';
async function bootstrap() {
	const app = await NestFactory.create(AppModule);
    refreshCookieOptions();
	app.useGlobalPipes(new ValidationPipe({ transform: true }));
	app.useGlobalInterceptors(new LoggingInterceptor());
	app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
	app.enableCors({
		origin: authOrigins(),
        allowedHeaders: ['Content-Type', 'Authorization', 'Apollo-Require-Preflight', 'X-Kidify-CSRF'],
        methods: ['GET', 'POST', 'OPTIONS'],
		credentials: true,
	});

	app.use(graphqlUploadExpress({ maxFileSize: 15000000, maxFiles: 10 }));

	app.useWebSocketAdapter(new WsAdapter(app));
	await app.listen(process.env.PORT_API ?? 3000);
}
bootstrap();
