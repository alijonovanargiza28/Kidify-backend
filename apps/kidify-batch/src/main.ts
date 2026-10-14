import { NestFactory } from "@nestjs/core";
import { KidifyBatchModule } from "./kidify-batch.module";
import { ValidationPipe } from "@nestjs/common";
import { LoggingInterceptor } from "apps/kidify-api/src/libs/enums/intersepter/loggingIntercepter";

async function bootstrap() {
  const app = await NestFactory.create(KidifyBatchModule);
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(new LoggingInterceptor());

  await app.listen(process.env.PORT_BATCH ?? 3000);

  console.log("PORT_BATCH:", process.env.PORT_BATCH);
}

bootstrap();
