import { Resolver, Query, Mutation, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { Types } from "mongoose";
import { Member } from "../../libs/dto/member/member";
import { Review, Reviews, ReviewInput } from "./review";
import { ReviewService } from "./review.service";
import { ReviewGroup } from "../../libs/enums/marketplace.enum";
import { MemberType } from "../../libs/enums/member.enum";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthMember } from "../auth/decorators/authMember.decorator";
import { PageInquiry } from "../../libs/marketplace";
import { shapeIntoMongoObjectId } from "../../libs/config";
@Resolver()
export class ReviewResolver {
  constructor(private readonly service: ReviewService) {}
  @UseGuards(AuthGuard)
  @Mutation(() => Review)
  likeReview(@Args("reviewId") id: string, @AuthMember() actor: Member) {
    return this.service.like(actor, shapeIntoMongoObjectId(id));
  }
  @UseGuards(AuthGuard)
  @Mutation(() => Review)
  replyReview(@Args("reviewId") id: string, @Args("text") text: string, @AuthMember() actor: Member) {
    return this.service.reply(actor, shapeIntoMongoObjectId(id), text);
  }
  @Query(() => Reviews) getSellerTopReviews(@Args("sellerId") id: string) {
    return this.service.sellerTop(shapeIntoMongoObjectId(id));
  }
  @Roles(MemberType.ADMIN)
  @UseGuards(RolesGuard)
  @Mutation(() => Review)
  likeReviewByAdmin(@Args("reviewId") id: string, @AuthMember() actor: Member) {
    return this.service.like(actor, shapeIntoMongoObjectId(id));
  }
  @Roles(MemberType.ADMIN)
  @UseGuards(RolesGuard)
  @Mutation(() => Review)
  replyReviewByAdmin(
    @Args("reviewId") id: string,
    @Args("text") text: string,
    @AuthMember() actor: Member,
  ) {
    return this.service.reply(actor, shapeIntoMongoObjectId(id), text);
  }
  @UseGuards(AuthGuard) @Mutation(() => Review) createReview(
    @Args("input") input: ReviewInput,
    @AuthMember("_id") memberId: Types.ObjectId,
  ) {
    return this.service.create(memberId, input);
  }
  @Query(() => Reviews) getReviews(
    @Args("group", { type: () => ReviewGroup }) group: ReviewGroup,
    @Args("targetId") id: string,
    @Args("input") input: PageInquiry,
  ) {
    return this.service.list(group, shapeIntoMongoObjectId(id), input);
  }
  @Roles(MemberType.ADMIN)
  @UseGuards(RolesGuard)
  @Mutation(() => Review)
  removeReviewByAdmin(@Args("reviewId") id: string) {
    return this.service.remove(shapeIntoMongoObjectId(id));
  }
  @Roles(MemberType.ADMIN)
  @UseGuards(RolesGuard)
  @Query(() => Reviews)
  getReviewsByAdmin(
    @Args("group", { type: () => ReviewGroup }) group: ReviewGroup,
    @Args("targetId") id: string,
    @Args("input") input: PageInquiry,
  ) {
    return this.service.list(group, shapeIntoMongoObjectId(id), input, true);
  }
}
