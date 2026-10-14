import { Field, Int, ObjectType, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsNotEmpty, IsInt } from 'class-validator';

import { TotalCounter } from '../../libs/dto/member/member';
import { ContentStatus, FAQCategory } from '../../libs/enums/marketplace.enum';

@InputType()
export class FAQInput {
	@IsString() @IsNotEmpty() @Field(() => String) question!: string;
	@IsString() @IsNotEmpty() @Field(() => String) answer!: string;
	@Field(() => FAQCategory) category!: FAQCategory;
	@IsOptional() @IsInt() @Field(() => Int, { nullable: true }) sortOrder?: number;
	@IsOptional() @Field(() => ContentStatus, { nullable: true }) status?: ContentStatus;
}
@ObjectType()
export class FAQ {
	@Field(() => String) _id!: string;
	@Field(() => String) question!: string;
	@Field(() => String) answer!: string;
	@Field(() => FAQCategory) category!: FAQCategory;
	@Field(() => Int, { nullable: true }) sortOrder?: number;
	@Field(() => ContentStatus) status!: ContentStatus;
	@Field(() => Date) createdAt!: Date;
	@Field(() => Date) updatedAt!: Date;
}
@ObjectType()
export class FAQs {
	@Field(() => [FAQ]) list!: FAQ[];
	@Field(() => [TotalCounter]) metaCounter!: TotalCounter[];
}
