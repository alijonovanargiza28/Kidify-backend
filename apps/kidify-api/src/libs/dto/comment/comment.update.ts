import { Field, InputType } from "@nestjs/graphql";
import { IsNotEmpty, IsOptional, Length } from "class-validator";
import { CommentStatus } from "../../enums/comment.enum";

@InputType()
export class CommentUpdate {
  @IsNotEmpty()
  @Field(() => String)
  _id!: string;

  @IsOptional()
  @Field(() => CommentStatus, { nullable: true })
  commentStatus?: CommentStatus;

  @IsOptional()
  @Length(1, 100)
  @Field(() => String, { nullable: true })
  commentContent?: string;
}
