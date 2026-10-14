import { Field, Float, Int, ObjectType, InputType } from "@nestjs/graphql";
import {
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
import { Product } from "../product/product";
@InputType()
export class CartItemInput {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  @Field(() => Int, { nullable: true })
  ageMonth?: number;
  @IsMongoId() @Field(() => String) productId!: string;
  @IsOptional()
  @IsMongoId()
  @Field(() => String, { nullable: true })
  variantId?: string;
  @IsInt() @Min(1) @Max(1000) @Field(() => Int) quantity!: number;
}
@ObjectType()
export class CartItem {
  @Field(() => Int, { nullable: true }) ageMonth?: number;
  @Field(() => String) _id!: string;
  @Field(() => String) productId!: string;
  @Field(() => String) variantId!: string;
  @Field(() => String, { nullable: true }) color?: string;
  @Field(() => String, { nullable: true }) size?: string;
  @Field(() => Int) quantity!: number;
  @Field(() => Float, { nullable: true }) unitPrice?: number;
  @Field(() => Float, { nullable: true }) lineTotal?: number;
  @Field(() => Boolean) available!: boolean;
  @Field(() => Product, { nullable: true }) product?: Product;
}
@ObjectType()
export class Cart {
  @Field(() => String) _id!: string;
  @Field(() => String) memberId!: string;
  @Field(() => [CartItem]) items!: CartItem[];
  @Field(() => Float) subtotal!: number;
  @Field(() => Date) updatedAt!: Date;
}
