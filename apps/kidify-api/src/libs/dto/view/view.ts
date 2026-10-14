import { Field, ObjectType } from "@nestjs/graphql";
import type { ObjectId } from "mongoose";

@ObjectType()
export class View {
  @Field(() => String)
  _id!: ObjectId;

  @Field(() => String)
  viewRefId!: ObjectId;

  @Field(() => String)
  memberId!: ObjectId;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}
