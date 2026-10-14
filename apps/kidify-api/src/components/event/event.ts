import { Field, ObjectType, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsNotEmpty, MaxLength, ArrayMinSize, ArrayMaxSize } from 'class-validator';

import { TotalCounter } from '../../libs/dto/member/member';
import { ContentStatus, EventType } from '../../libs/enums/marketplace.enum';

@InputType()
export class EventInput {
	@IsString() @IsNotEmpty() @MaxLength(150) @Field(() => String) title!: string;
	@IsString() @IsNotEmpty() @Field(() => String) description!: string;
	@ArrayMinSize(1) @ArrayMaxSize(10) @IsString({ each: true }) @Field(() => [String]) images!: string[];
	@Field(() => EventType) eventType!: EventType;
	@Field(() => Date) startAt!: Date;
	@Field(() => Date) endAt!: Date;
	@IsOptional() @Field(() => ContentStatus, { nullable: true }) status?: ContentStatus;
}
@ObjectType()
export class Event {
	@Field(() => String) _id!: string;
	@Field(() => String) title!: string;
	@Field(() => String) description!: string;
	@Field(() => [String]) images!: string[];
	@Field(() => EventType) eventType!: EventType;
	@Field(() => Date) startAt!: Date;
	@Field(() => Date) endAt!: Date;
	@Field(() => ContentStatus) status!: ContentStatus;
	@Field(() => Date) createdAt!: Date;
	@Field(() => Date) updatedAt!: Date;
}
@ObjectType()
export class Events {
	@Field(() => [Event]) list!: Event[];
	@Field(() => [TotalCounter]) metaCounter!: TotalCounter[];
}
