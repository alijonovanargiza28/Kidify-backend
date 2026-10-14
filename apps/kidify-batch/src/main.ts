import { NestFactory } from "@nestjs/core";
import { KidifyBatchModule } from "./kidify-batch.module";
import { ValidationPipe } from "@nestjs/common";
import { LoggingInterceptor } from "apps/kidify-api/src/libs/enums/intersepter/loggingIntercepter";

import {
  apiPort,
  assertProductionEnvironment,
} from "../../kidify-api/src/libs/runtime";

async function bootstrap() {
  const app = await NestFactory.create(KidifyBatchModule);
  assertProductionEnvironment();
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(new LoggingInterceptor());

  await app.listen(apiPort(true), "0.0.0.0");

  console.log("PORT_BATCH:", process.env.PORT_BATCH);
}

bootstrap();
