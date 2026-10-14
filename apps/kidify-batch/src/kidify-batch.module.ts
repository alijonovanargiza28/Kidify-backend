import { Module } from "@nestjs/common";
import { KidifyBatchController } from "./kidify-batch.controller";
import { KidifyBatchService } from "./kidify-batch.service";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { ScheduleModule } from "@nestjs/schedule";

import { MongooseModule } from "@nestjs/mongoose";
import LikeSchema from "apps/kidify-api/src/schemas/Like.model";
import NotificationSchema from "apps/kidify-api/src/schemas/Notification.model";
import ProductSchema from "apps/kidify-api/src/schemas/Product.model";
import MemberSchema from "apps/kidify-api/src/schemas/Member.model";

@Module({
  imports: [
    ConfigModule.forRoot(),
    DatabaseModule,
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([{ name: "Product", schema: ProductSchema }]),
    MongooseModule.forFeature([
      { name: "Member", schema: MemberSchema },
      { name: "like", schema: LikeSchema },
      { name: "Notification", schema: NotificationSchema },
    ]),
  ],
  controllers: [KidifyBatchController],
  providers: [KidifyBatchService],
})
export class KidifyBatchModule {}
