import { Field, ObjectType, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsNotEmpty, MaxLength } from 'class-validator';

import { TotalCounter } from '../../libs/dto/member/member';
import { ContentStatus } from '../../libs/enums/marketplace.enum';

@InputType()
export class BrandInput {
	@IsString() @IsNotEmpty() @MaxLength(150) @Field(() => String) brandName!: string;
	@IsOptional() @IsString() @Field(() => String, { nullable: true }) brandImage?: string;
	@IsOptional() @IsString() @Field(() => String, { nullable: true }) brandDescription?: string;
	@IsOptional() @Field(() => ContentStatus, { nullable: true }) brandStatus?: ContentStatus;
}
@ObjectType()
export class Brand {
	@Field(() => String) _id!: string;
	@Field(() => String) brandName!: string;
	@Field(() => String, { nullable: true }) brandImage?: string;
	@Field(() => String, { nullable: true }) brandDescription?: string;
	@Field(() => ContentStatus) brandStatus!: ContentStatus;
	@Field(() => Date) createdAt!: Date;
	@Field(() => Date) updatedAt!: Date;
}
@ObjectType()
export class Brands {
	@Field(() => [Brand]) list!: Brand[];
	@Field(() => [TotalCounter]) metaCounter!: TotalCounter[];
}
