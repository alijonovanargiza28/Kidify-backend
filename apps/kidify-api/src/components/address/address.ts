import { Field, ObjectType, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsNotEmpty, MaxLength } from 'class-validator';



@InputType()
export class AddressInput {
	@IsString() @IsNotEmpty() @MaxLength(100) @Field(() => String) recipientName!: string;
	@IsString() @IsNotEmpty() @MaxLength(30) @Field(() => String) phone!: string;
	@IsString() @IsNotEmpty() @MaxLength(100) @Field(() => String) region!: string;
	@IsString() @IsNotEmpty() @MaxLength(100) @Field(() => String) city!: string;
	@IsOptional() @IsString() @Field(() => String, { nullable: true }) district?: string;
	@IsString() @IsNotEmpty() @MaxLength(300) @Field(() => String) street!: string;
	@IsOptional() @IsString() @Field(() => String, { nullable: true }) postalCode?: string;
	@IsOptional() @IsString() @Field(() => String, { nullable: true }) instructions?: string;
	@IsOptional() @Field(() => Boolean, { nullable: true }) isDefault?: boolean;
}
@ObjectType()
export class AddressSnapshot {
	@Field(() => String) recipientName!: string;
	@Field(() => String) phone!: string;
	@Field(() => String) region!: string;
	@Field(() => String) city!: string;
	@Field(() => String, { nullable: true }) district?: string;
	@Field(() => String) street!: string;
	@Field(() => String, { nullable: true }) postalCode?: string;
	@Field(() => String, { nullable: true }) instructions?: string;
}
@ObjectType()
export class Address {
	@Field(() => String) _id!: string;
	@Field(() => String) memberId!: string;
	@Field(() => String) recipientName!: string;
	@Field(() => String) phone!: string;
	@Field(() => String) region!: string;
	@Field(() => String) city!: string;
	@Field(() => String, { nullable: true }) district?: string;
	@Field(() => String) street!: string;
	@Field(() => String, { nullable: true }) postalCode?: string;
	@Field(() => String, { nullable: true }) instructions?: string;
	@Field(() => Boolean) isDefault!: boolean;
	@Field(() => Date) createdAt!: Date;
}
