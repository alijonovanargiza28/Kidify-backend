import { Max, IsInt, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Field, InputType, Int } from '@nestjs/graphql';

import { IsNotEmpty, IsOptional, Length, Min, IsIn } from 'class-validator';

import { MemberAuthType, MemberStatus, MemberType } from '../../enums/member.enum';

import { availableSellerSorts, availableMemberSorts } from '../../config';

import { Direction } from '../../enums/common.enum';

@InputType()
export class MemberInput {
	@IsNotEmpty()
	@Length(3, 12)
	@Field(() => String)
	memberNick!: string;

	@IsNotEmpty()
	@Length(5, 12)
	@Field(() => String)
	memberPassword!: string;

	@IsNotEmpty()
	@Field(() => String)
	memberPhone!: string;

	@IsOptional()
	@Field(() => MemberType, { nullable: true })
	memberType?: MemberType; // Ignored: backend assigns the role.

	@IsOptional()
	@Length(8, 128)
	@Field(() => String, { nullable: true })
	sellerCode?: string;

	@IsOptional()
	@Field(() => MemberAuthType, { nullable: true })
	memberAuthType?: MemberAuthType;
}

@InputType()
export class LoginInput {
	@IsNotEmpty()
	@Length(3, 12)
	@Field(() => String)
	memberNick!: string;

	@IsNotEmpty()
	@Length(5, 12)
	@Field(() => String)
	memberPassword!: string;
}

@InputType()
class AISearch {
	@IsOptional()
	@Field(() => String, { nullable: true })
	text?: string;
}

@InputType()
export class SellersInquiry {
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

	@IsOptional()
	@IsIn(availableSellerSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@Field(() => Direction, { nullable: true })
	direction?: Direction;

	@IsNotEmpty()
	@ValidateNested()
	@Type(() => AISearch)
	@Field(() => AISearch)
	search!: AISearch;
}

@InputType()
class MISearch {
	@IsOptional()
	@Field(() => MemberStatus, { nullable: true })
	memberStatus?: MemberStatus;

	@IsOptional()
	@Field(() => MemberType, { nullable: true })
	memberType?: MemberType; // Ignored: backend assigns the role.

	@IsOptional()
	@Length(8, 128)
	@Field(() => String, { nullable: true })
	sellerCode?: string;

	@IsOptional()
	@Field(() => String, { nullable: true })
	text?: string;
}

@InputType()
export class MembersInquiry {
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

	@IsOptional()
	@IsIn(availableMemberSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@Field(() => Direction, { nullable: true })
	direction?: Direction;

	@IsNotEmpty()
	@ValidateNested()
	@Type(() => MISearch)
	@Field(() => MISearch)
	search!: MISearch;
}
