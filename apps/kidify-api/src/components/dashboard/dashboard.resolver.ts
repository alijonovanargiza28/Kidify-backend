import { Resolver, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { AdminDashboard, SellerDashboard } from './dashboard';
import { DashboardService } from './dashboard.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { MemberType } from '../../libs/enums/member.enum';
@Resolver()
export class DashboardResolver {
	constructor(private readonly service: DashboardService) {}
	@Roles(MemberType.ADMIN) @UseGuards(RolesGuard) @Query(() => AdminDashboard) getAdminDashboard() {
		return this.service.admin();
	}
	@Roles(MemberType.SELLER) @UseGuards(RolesGuard) @Query(() => SellerDashboard) getSellerDashboard(
		@AuthMember('_id') sellerId: Types.ObjectId,
	) {
		return this.service.seller(sellerId);
	}
}
