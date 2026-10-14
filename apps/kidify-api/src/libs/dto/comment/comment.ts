import { Field, Int, ObjectType } from '@nestjs/graphql';
import type{ ObjectId } from 'mongoose';
import { CommentGroup, CommentStatus } from '../../enums/comment.enum';
import { Member, TotalCounter } from '../member/member';

@ObjectType()
export class Comment {
    @Field(() => Int, { nullable: true }) likeCount?: number;
    @Field(() => Boolean, { nullable: true }) verifiedPurchase?: boolean;
    @Field(() => String, { nullable: true }) replyText?: string;
    @Field(() => String, { nullable: true }) replyAuthorId?: string;
	@Field(() => String)
	_id!: ObjectId;

	@Field(() => CommentStatus)
	commentStatus!: CommentStatus;

	@Field(() => CommentGroup)
	commentGroup!: CommentGroup;

	@Field(() => String)
	commentContent!: string;

	@Field(() => String)
	commentRefId!: ObjectId;

	@Field(() => String)
	memberId!: ObjectId;

	@Field(() => Date)
	createdAt!: Date;

	@Field(() => Date)
	updatedAt!: Date;

	/** from aggregation **/

	@Field(() => Member, { nullable: true })
	memberData?: Member;
}

@ObjectType()
export class Comments {
	@Field(() => [Comment])
	list!: Comment[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter!: TotalCounter[];
}
