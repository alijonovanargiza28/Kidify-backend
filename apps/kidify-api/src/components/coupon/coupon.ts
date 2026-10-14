import { Field, Float, Int, ObjectType, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsNotEmpty, IsInt, IsNumber, Min, MaxLength } from 'class-validator';

import { TotalCounter } from '../../libs/dto/member/member';
import { DiscountType, CouponStatus } from '../../libs/enums/marketplace.enum';
@InputType()
export class CouponInput {
	@IsString() @IsNotEmpty() @MaxLength(80) @Field(() => String) code!: string;
	@Field(() => DiscountType) discountType!: DiscountType;
	@IsNumber() @Min(0) @Field(() => Float) discountValue!: number;
	@IsOptional() @IsNumber() @Min(0) @Field(() => Float, { nullable: true }) minimumOrder?: number;
	@IsOptional() @IsNumber() @Min(0) @Field(() => Float, { nullable: true }) maximumDiscount?: number;
	@IsOptional() @IsInt() @Min(1) @Field(() => Int, { nullable: true }) usageLimit?: number;
	@IsOptional() @Field(() => Date, { nullable: true }) startAt?: Date;
	@IsOptional() @Field(() => Date, { nullable: true }) endAt?: Date;
}
@ObjectType()
export class Coupon {
	@Field(() => String) _id!: string;
	@Field(() => String) code!: string;
	@Field(() => DiscountType) discountType!: DiscountType;
	@Field(() => Float) discountValue!: number;
	@Field(() => Float, { nullable: true }) minimumOrder?: number;
	@Field(() => Float, { nullable: true }) maximumDiscount?: number;
	@Field(() => Int, { nullable: true }) usageLimit?: number;
	@Field(() => Int) usedCount!: number;
	@Field(() => Date, { nullable: true }) startAt?: Date;
	@Field(() => Date, { nullable: true }) endAt?: Date;
	@Field(() => CouponStatus) status!: CouponStatus;
	@Field(() => String) createdBy!: string;
	@Field(() => Date) createdAt!: Date;
}
@ObjectType()
export class Coupons {
	@Field(() => [Coupon]) list!: Coupon[];
	@Field(() => [TotalCounter]) metaCounter!: TotalCounter[];
}
@ObjectType()
export class CouponQuote {
	@Field(() => Float) discount!: number;
	@Field(() => Float) total!: number;
}
