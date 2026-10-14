import { Field, Int, ObjectType, InputType } from "@nestjs/graphql";
import { IsArray, Matches, IsOptional, IsString, IsNotEmpty, IsInt, Min, Max, MaxLength, ArrayMaxSize, IsMongoId } from "class-validator";

import { TotalCounter } from "../../libs/dto/member/member";
import { ReviewGroup, ContentStatus } from "../../libs/enums/marketplace.enum";

@InputType()
export class ReviewInput {
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true })
  @Matches(/^uploads\/review\/[a-zA-Z0-9-]+\.(jpg|png)$/, { each: true })
  @Field(() => [String], { nullable: true }) images?: string[];
  @Field(() => ReviewGroup) group!: ReviewGroup;
  @IsMongoId() @Field(() => String) targetId!: string;
  @IsMongoId() @Field(() => String) orderId!: string;
  @IsInt() @Min(1) @Max(5) @Field(() => Int) rating!: number;
  @IsString() @IsNotEmpty() @MaxLength(3000) @Field(() => String) text!: string;
}
@ObjectType()
export class Review {
  @Field(() => String, { nullable: true }) authorNick?: string;
  @Field(() => String, { nullable: true }) authorImage?: string;
  @Field(() => [String], { nullable: true }) images?: string[];
  @Field(() => Boolean, { nullable: true }) verifiedPurchase?: boolean;
  @Field(() => String, { nullable: true }) replyRole?: string;
  @Field(() => Int, { defaultValue: 0 }) likeCount!: number;
  @Field(() => String, { nullable: true }) adminReply?: string;
  @Field(() => String, { nullable: true }) replyAuthorId?: string;
  @Field(() => Date, { nullable: true }) replyAt?: Date;
  @Field(() => String) _id!: string;
  @Field(() => ReviewGroup) group!: ReviewGroup;
  @Field(() => String) targetId!: string;
  @Field(() => String) orderId!: string;
  @Field(() => String) authorId!: string;
  @Field(() => Int) rating!: number;
  @Field(() => String) text!: string;
  @Field(() => ContentStatus) status!: ContentStatus;
  @Field(() => Date) createdAt!: Date;
}
@ObjectType()
export class RatingCount {
  @Field(() => Int) rating!: number;
  @Field(() => Int) count!: number;
}
@ObjectType()
export class Reviews {
  @Field(() => [RatingCount], { nullable: true }) ratingBreakdown?: RatingCount[];
  @Field(() => [Review]) list!: Review[];
  @Field(() => [TotalCounter]) metaCounter!: TotalCounter[];
}
