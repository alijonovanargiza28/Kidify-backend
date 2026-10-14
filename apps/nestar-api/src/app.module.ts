// Asosiy app module bugichi

import { Module } from '@nestjs/common';

import { AppController } from './app.controller';

import { AppService } from './app.service';

import { ConfigModule } from '@nestjs/config';

import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';

import { AppResolver } from './app.resolver';

import { ComponentsModule } from './components/components.module';
import { DatabaseModule } from './database/database.module';

import { T } from './libs/types/common';
import { SocketModule } from './socket/socket.module';

@Module({
	imports: [
		ConfigModule.forRoot(), //env
		GraphQLModule.forRoot({
			//reast api => Graphql api
			driver: ApolloDriver,
			playground: true,
			uploads: false,
            csrfPrevention: true,
			context: ({ req, res }) => ({ req, res }),
			autoSchemaFile: true,

			formatError: (error: T) => {
				const graphqlFormattedError = {
					code: error?.extensions?.code,

					message:
						error?.extensions?.exception?.response?.message || error?.extensions?.response?.message || error?.message,
				};

				console.log('GRAPHQL GLOBAL ERR:', graphqlFormattedError);
				return { ...graphqlFormattedError, path: error.path, extensions: { code: graphqlFormattedError.message === 'UNAUTHORIZED' ? 'UNAUTHENTICATED' : error?.extensions?.code || 'INTERNAL_SERVER_ERROR' } };
			},
		}),

		ComponentsModule,
		DatabaseModule,
		SocketModule,
	],

	controllers: [AppController],

	providers: [AppService, AppResolver],
})
export class AppModule {}
