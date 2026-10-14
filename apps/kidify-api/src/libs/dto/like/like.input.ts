import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';

import { LikeGroup } from '../../enums/like.enum';
import { Types } from "mongoose";

@InputType()
export class LikeInput {
	@IsNotEmpty()
	@Field(() => String)
	memberId!: Types.ObjectId;

	@IsNotEmpty()
	@Field(() => String)
	likeRefId!:Types.ObjectId;

	@IsNotEmpty()
	@Field(() => LikeGroup)
	likeGroup!: LikeGroup;
}
