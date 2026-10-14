import { Max, IsInt, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Field, InputType, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, Min } from 'class-validator';
import { Types } from 'mongoose';

@InputType()
class FollowSearch {
	@IsOptional()
	@Field(() => String, { nullable: true })
	followingId?: Types.ObjectId;

	@IsOptional()
	@Field(() => String, { nullable: true })
	followerId?: Types.ObjectId;
}

@InputType()
export class FollowInquiry {
	@IsNotEmpty()
	@Min(1)
	@IsInt()
	@Field(() => Int)
	page!: number;

	@IsNotEmpty()
	@Min(1)
	@IsInt()
	@Max(100)
	@Field(() => Int)
	limit!: number;

	@IsNotEmpty()
	@ValidateNested()
	@Type(() => FollowSearch)
	@Field(() => FollowSearch)
	search!: FollowSearch;
}
