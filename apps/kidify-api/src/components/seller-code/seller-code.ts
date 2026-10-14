import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsOptional, Length } from 'class-validator';
import { Schema } from 'mongoose';
import { TotalCounter } from '../../libs/dto/member/member';
export enum SellerCodeStatus {
	ACTIVE = 'ACTIVE',
	USED = 'USED',
	EXPIRED = 'EXPIRED',
	REVOKED = 'REVOKED',
}
registerEnumType(SellerCodeStatus, { name: 'SellerCodeStatus' });
@ObjectType()
export class SellerCode {
	@Field(() => String) _id!: string;
	@Field(() => String) code!: string;
	@Field(() => SellerCodeStatus) status!: SellerCodeStatus;
	@Field(() => Date, { nullable: true }) expiresAt?: Date;
	@Field(() => String, { nullable: true }) usedBy?: string;
	@Field(() => Date, { nullable: true }) usedAt?: Date;
	@Field(() => String) createdBy!: string;
	@Field(() => Date) createdAt!: Date;
	@Field(() => Date) updatedAt!: Date;
}
@ObjectType()
export class SellerCodes {
	@Field(() => [SellerCode]) list!: SellerCode[];
	@Field(() => [TotalCounter]) metaCounter!: TotalCounter[];
}
@InputType()
export class SellerCodeInput {
	@IsOptional() @Length(8, 128) @Field(() => String, { nullable: true }) code?: string;
	@IsOptional() @Field(() => Date, { nullable: true }) expiresAt?: Date;
}
export const SellerCodeSchema = new Schema(
	{
		code: { type: String, required: true, unique: true },
		status: { type: String, enum: SellerCodeStatus, default: SellerCodeStatus.ACTIVE },
		expiresAt: Date,
		usedBy: Schema.Types.ObjectId,
		usedAt: Date,
		createdBy: { type: Schema.Types.ObjectId, required: true },
	},
	{ timestamps: true, collection: 'sellerCodes' },
);
