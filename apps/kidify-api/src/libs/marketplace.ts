import { BadRequestException } from '@nestjs/common';
import { ClientSession, Connection, PipelineStage } from 'mongoose';
import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, Min, Max, IsOptional } from 'class-validator';

@InputType()
export class PageInquiry {
	@IsInt() @Min(1) @Field(() => Int, { defaultValue: 1 }) page: number = 1;
	@IsInt() @Min(1) @Max(100) @Field(() => Int, { defaultValue: 20 }) limit: number = 20;
	@IsOptional() @Field(() => Boolean, { defaultValue: false }) oldest: boolean = false;
}
export function facet(input: PageInquiry, extra: PipelineStage.FacetPipelineStage[] = []): PipelineStage {
	const page = input.page ?? 1,
		limit = input.limit ?? 20;
	if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100)
		throw new BadRequestException('INVALID_PAGINATION');
	return {
		$facet: { list: [{ $skip: (page - 1) * limit }, { $limit: limit }, ...extra], metaCounter: [{ $count: 'total' }] },
	};
}
export const escapeSearch = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export async function atomic<T>(connection: Connection, operation: (session: ClientSession) => Promise<T>): Promise<T> {
	const session = await connection.startSession();
	try {
		const result = await session.withTransaction(() => operation(session));
		if (result === undefined) throw new BadRequestException('TRANSACTION_FAILED');
		return result;
	} catch (error) {
		if (
			error instanceof Error &&
			/Transaction numbers are only allowed|does not support retryable writes/.test(error.message)
		) {
			throw new BadRequestException('MONGODB_REPLICA_SET_REQUIRED');
		}
		throw error;
	} finally {
		await session.endSession();
	}
}
