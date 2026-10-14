import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import { AuthGuard } from './auth.guard';
@Injectable()
export class RolesGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly authService: AuthService,
	) {}
	async canActivate(context: ExecutionContext): Promise<boolean> {
		await new AuthGuard(this.authService).canActivate(context);
		const roles = this.reflector.getAllAndOverride<string[]>('roles', [context.getHandler(), context.getClass()]);
		const request =
			context.getType<string>() === 'graphql' ? context.getArgByIndex(2).req : context.switchToHttp().getRequest();
		if (roles && !roles.includes(request.body.authMember.memberType)) throw new ForbiddenException('FORBIDDEN');
		return true;
	}
}
