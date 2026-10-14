import { Field, Float, Int, ObjectType, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsNotEmpty, MaxLength, IsMongoId, IsArray, ArrayMinSize, ArrayMaxSize, ArrayUnique } from 'class-validator';

import { TotalCounter } from '../../libs/dto/member/member';
import { OrderStatus, PaymentStatus } from '../../libs/enums/marketplace.enum';
import { AddressSnapshot } from '../address/address';
import { PageInquiry } from '../../libs/marketplace';
@InputType()
export class CheckoutInput {
	@IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ArrayUnique() @IsMongoId({each:true})
	@Field(() => [String], {nullable:true}) cartItemIds?: string[];
	@IsMongoId() @Field(() => String) addressId!: string;
	@IsOptional() @IsString() @Field(() => String, { nullable: true }) couponCode?: string;
	@IsString() @IsNotEmpty() @MaxLength(100) @Field(() => String) requestId!: string;
}
@ObjectType()
export class OrderItem {
	@Field(() => String) _id!: string;
	@Field(() => String) productId!: string;
	@Field(() => String) sellerId!: string;
	@Field(() => String) productName!: string;
	@Field(() => String, { nullable: true }) productImage?: string;
	@Field(() => String) variantId!: string;
	@Field(() => String, { nullable: true }) color?: string;
	@Field(() => String, { nullable: true }) size?: string;
	@Field(() => Int) quantity!: number;
	@Field(() => Float) unitPrice!: number;
	@Field(() => Float) discount!: number;
	@Field(() => Float) finalUnitPrice!: number;
	@Field(() => Float) finalItemPrice!: number;
	@Field(() => OrderStatus) status!: OrderStatus;
}
@ObjectType()
export class Order {
	@Field(() => String) _id!: string;
	@Field(() => String) memberId!: string;
	@Field(() => [OrderItem]) items!: OrderItem[];
	@Field(() => AddressSnapshot) shippingAddress!: AddressSnapshot;
	@Field(() => Float) subtotal!: number;
	@Field(() => Float) productDiscount!: number;
	@Field(() => Float) couponDiscount!: number;
	@Field(() => Float) deliveryFee!: number;
	@Field(() => Float) total!: number;
	@Field(() => OrderStatus) status!: OrderStatus;
	@Field(() => PaymentStatus) paymentStatus!: PaymentStatus;
	@Field(() => String) paymentId!: string;
	@Field(() => String) deliveryId!: string;
	@Field(() => String, { nullable: true }) couponId?: string;
	@Field(() => Date) createdAt!: Date;
	@Field(() => Date) updatedAt!: Date;
}
@ObjectType()
export class Orders {
	@Field(() => [Order]) list!: Order[];
	@Field(() => [TotalCounter]) metaCounter!: TotalCounter[];
}
@ObjectType()
export class SellerOrder {
	@Field(() => String) _id!: string;
	@Field(() => [OrderItem]) items!: OrderItem[];
	@Field(() => OrderStatus) status!: OrderStatus;
	@Field(() => PaymentStatus) paymentStatus!: PaymentStatus;
	@Field(() => Date) createdAt!: Date;
}
@ObjectType()
export class SellerOrders {
	@Field(() => [SellerOrder]) list!: SellerOrder[];
	@Field(() => [TotalCounter]) metaCounter!: TotalCounter[];
}

@InputType()
export class OrdersInquiry extends PageInquiry {
	@IsOptional() @Field(() => OrderStatus, { nullable: true }) status?: OrderStatus;
}
