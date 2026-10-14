import { Field, Float, ObjectType } from '@nestjs/graphql';


import { TotalCounter } from '../../libs/dto/member/member';
import { PaymentStatus } from '../../libs/enums/marketplace.enum';
@ObjectType()
export class Payment {
	@Field(() => String) _id!: string;
	@Field(() => String) orderId!: string;
	@Field(() => String) memberId!: string;
	@Field(() => Float) amount!: number;
	@Field(() => PaymentStatus) status!: PaymentStatus;
	@Field(() => Date, { nullable: true }) paidAt?: Date;
	@Field(() => Date) createdAt!: Date;
}

@ObjectType()
export class Payments {
	@Field(() => [Payment]) list!: Payment[];
	@Field(() => [TotalCounter]) metaCounter!: TotalCounter[];
}
