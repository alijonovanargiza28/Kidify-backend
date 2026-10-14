import { authOrigins, refreshCookieOptions } from "./components/auth/auth-http";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger, ValidationPipe } from "@nestjs/common";
import { LoggingInterceptor } from "./libs/enums/intersepter/loggingIntercepter";
import graphqlUploadExpress = require("graphql-upload/graphqlUploadExpress.js");
import * as express from "express";
import { WsAdapter } from "@nestjs/platform-ws";
import { mkdir, access } from "fs/promises";
import { constants } from "fs";
import {
  apiPort,
  assertProductionEnvironment,
  uploadsDirectory,
} from "./libs/runtime";
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  assertProductionEnvironment();
  refreshCookieOptions();
  app.enableShutdownHooks();
  app.getHttpAdapter().getInstance().disable("x-powered-by");
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalInterceptors(new LoggingInterceptor());
  const uploads = uploadsDirectory();
  await mkdir(uploads, { recursive: true });
  await access(uploads, constants.W_OK);
  app.use(
    "/uploads",
    express.static(uploads, {
      dotfiles: "deny",
      setHeaders: (res) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
      },
    }),
  );
  app.enableCors({
    origin: authOrigins(),
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Apollo-Require-Preflight",
      "X-Kidify-CSRF",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  });
  app.use(
    "/graphql",
    graphqlUploadExpress({ maxFileSize: 15000001, maxFiles: 10 }),
  );
  app.useWebSocketAdapter(new WsAdapter(app));
  await app.listen(apiPort(), "0.0.0.0");
}
bootstrap().catch(() => {
  Logger.error(
    "API startup failed; check required environment variables, database connectivity and upload storage.",
    "Bootstrap",
  );
  process.exitCode = 1;
  process.exit(1);
});
