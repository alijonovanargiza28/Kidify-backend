import { Field, Float, Int, ObjectType, InputType } from "@nestjs/graphql";
import {
  Matches,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsInt,
  IsNumber,
  Min,
  Max,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsMongoId,
} from "class-validator";
import { Type } from "class-transformer";
import { TotalCounter } from "../../libs/dto/member/member";

@InputType()
export class MessageInput {
  @IsOptional()
  @IsString()
  @Matches(/^[\w-]{16,80}$/)
  @MaxLength(80)
  @Field(() => String, { nullable: true })
  clientMessageId?: string;
  @IsMongoId() @Field(() => String) receiverId!: string;
  @IsOptional()
  @IsMongoId()
  @Field(() => String, { nullable: true })
  productId?: string;
  @IsString() @IsNotEmpty() @MaxLength(3000) @Field(() => String) text!: string;
}
@ObjectType()
export class ChatMessage {
  @Field(() => String) _id!: string;
  @Field(() => String) senderId!: string;
  @Field(() => String) receiverId!: string;
  @Field(() => String, { nullable: true }) productId?: string;
  @Field(() => String) text!: string;
  @Field(() => Boolean) isRead!: boolean;
  @Field(() => Date) createdAt!: Date;
}
@ObjectType()
export class ChatMessages {
  @Field(() => [ChatMessage]) list!: ChatMessage[];
  @Field(() => [TotalCounter]) metaCounter!: TotalCounter[];
}
