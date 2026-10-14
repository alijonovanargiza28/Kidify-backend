// Asosiy app module bugichi

import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";

import { AppService } from "./app.service";

import { ConfigModule } from "@nestjs/config";

import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver } from "@nestjs/apollo";

import { AppResolver } from "./app.resolver";

import { ComponentsModule } from "./components/components.module";
import { DatabaseModule } from "./database/database.module";

import { formatGraphqlError } from "./libs/graphql-error";
import { HealthController } from "./health.controller";
import { SocketModule } from "./socket/socket.module";

@Module({
  imports: [
    ConfigModule.forRoot(), //env
    GraphQLModule.forRoot({
      //reast api => Graphql api
      driver: ApolloDriver,
      playground: process.env.NODE_ENV !== "production",
      introspection: process.env.NODE_ENV !== "production",
      includeStacktraceInErrorResponses: false,
      uploads: false,
      csrfPrevention: true,
      context: ({ req, res }) => ({ req, res }),
      autoSchemaFile: true,

      formatError: formatGraphqlError,
    }),

    ComponentsModule,
    DatabaseModule,
    SocketModule,
  ],

  controllers: [AppController, HealthController],

  providers: [AppService, AppResolver],
})
export class AppModule {}
