import { Max, IsInt, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Field, InputType, Int } from '@nestjs/graphql';
import { IsIn, IsNotEmpty, IsOptional, Length, Min } from 'class-validator';
import mongoose from 'mongoose';

import { BoardArticleCategory, BoardArticleStatus } from '../../enums/board-article.enum';

import { Direction } from '../../enums/common.enum';
import { availableBoardArticleSorts } from '../../config';

@InputType()
export class BoardArticleInput {
	@IsNotEmpty()
	@Field(() => BoardArticleCategory)
	articleCategory!: BoardArticleCategory;

	@IsNotEmpty()
	@Length(3, 50)
	@Field(() => String)
	articleTitle!: string;

	@IsNotEmpty()
	@Length(3, 250)
	@Field(() => String)
	articleContent!: string;

	@IsOptional()
	@Field(() => String, { nullable: true })
	articleImage?: string;

	memberId?: mongoose.Types.ObjectId;
}

@InputType()
class BAISearch {
	@IsOptional()
	@Field(() => BoardArticleCategory, { nullable: true })
	articleCategory?: BoardArticleCategory;

	@IsOptional()
	@Field(() => String, { nullable: true })
	text?: string;

	@IsOptional()
	@Field(() => String, { nullable: true })
	memberId?: string;
}

@InputType()
export class BoardArticlesInquiry {
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
	@IsIn(availableBoardArticleSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@Field(() => Direction, { nullable: true })
	direction?: Direction;

	@IsNotEmpty()
	@ValidateNested()
	@Type(() => BAISearch)
	@Field(() => BAISearch)
	search!: BAISearch;
}

@InputType()
class ABAISearch {
	@IsOptional()
	@Field(() => BoardArticleStatus, { nullable: true })
	articleStatus?: BoardArticleStatus;

	@IsOptional()
	@Field(() => BoardArticleCategory, { nullable: true })
	articleCategory?: BoardArticleCategory;
}

@InputType()
export class AllBoardArticlesInquiry {
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
	@IsIn(availableBoardArticleSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@Field(() => Direction, { nullable: true })
	direction?: Direction;

	@IsNotEmpty()
	@ValidateNested()
	@Type(() => ABAISearch)
	@Field(() => ABAISearch)
	search!: ABAISearch;
}
