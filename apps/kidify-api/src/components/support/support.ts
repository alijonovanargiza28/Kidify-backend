import { Field, ObjectType, InputType } from "@nestjs/graphql";
import { IsOptional, IsEnum, IsString, IsNotEmpty, MaxLength, IsMongoId } from "class-validator";

import { TotalCounter } from "../../libs/dto/member/member";
import { SupportStatus, FAQCategory } from "../../libs/enums/marketplace.enum";
@InputType()
export class SupportInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @Field(() => String)
  subject!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  @Field(() => String)
  message!: string;
  @IsEnum(FAQCategory) @Field(() => FAQCategory) category!: FAQCategory;
  @IsOptional()
  @IsMongoId()
  @Field(() => String, { nullable: true })
  relatedOrderId?: string;
}
@ObjectType()
export class SupportReply {
  @Field(() => String) authorId!: string;
  @Field(() => String) text!: string;
  @Field(() => Date) createdAt!: Date;
}
@ObjectType()
export class SupportTicket {
  @Field(() => String) _id!: string;
  @Field(() => String) creatorId!: string;
  @Field(() => String) subject!: string;
  @Field(() => String) message!: string;
  @IsEnum(FAQCategory) @Field(() => FAQCategory) category!: FAQCategory;
  @Field(() => String, { nullable: true }) relatedOrderId?: string;
  @Field(() => SupportStatus) status!: SupportStatus;
  @Field(() => String, { nullable: true }) assignedCS?: string;
  @Field(() => [SupportReply]) replies!: SupportReply[];
  @Field(() => Date) createdAt!: Date;
  @Field(() => Date) updatedAt!: Date;
}
@ObjectType()
export class SupportTickets {
  @Field(() => [SupportTicket]) list!: SupportTicket[];
  @Field(() => [TotalCounter]) metaCounter!: TotalCounter[];
}
