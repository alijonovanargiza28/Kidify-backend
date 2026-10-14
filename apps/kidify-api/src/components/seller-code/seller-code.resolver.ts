import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { SellerCode, SellerCodes, SellerCodeInput } from './seller-code';
import { SellerCodeService } from './seller-code.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType } from '../../libs/enums/member.enum';
import { PageInquiry } from '../../libs/marketplace';
import { shapeIntoMongoObjectId } from '../../libs/config';
@Resolver()
@Roles(MemberType.ADMIN)
@UseGuards(RolesGuard)
export class SellerCodeResolver {
	constructor(private readonly service: SellerCodeService) {}
	@Mutation(() => SellerCode) createSellerCode(
		@Args('input') input: SellerCodeInput,
		@AuthMember('_id') actor: Types.ObjectId,
	) {
		return this.service.create(actor, input);
	}
	@Query(() => SellerCodes) getSellerCodes(@Args('input') input: PageInquiry) {
		return this.service.list(input);
	}
	@Mutation(() => SellerCode) revokeSellerCode(@Args('codeId') id: string) {
		return this.service.revoke(shapeIntoMongoObjectId(id));
	}
}
