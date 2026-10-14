import { LikeModule } from "../like/like.module";
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import ReviewSchema from "../../schemas/Review.model";
import OrderSchema from "../../schemas/Order.model";
import ProductSchema from "../../schemas/Product.model";
import MemberSchema from "../../schemas/Member.model";
import { ReviewService } from "./review.service";
import { ReviewResolver } from "./review.resolver";
@Module({
  imports: [
    AuthModule,
    LikeModule,
    MongooseModule.forFeature([
      { name: "Review", schema: ReviewSchema },
      { name: "Order", schema: OrderSchema },
      { name: "Product", schema: ProductSchema },
      { name: "Member", schema: MemberSchema },
    ]),
  ],
  providers: [ReviewService, ReviewResolver],
  exports: [ReviewService],
})
export class ReviewModule {}
