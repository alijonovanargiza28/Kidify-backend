import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
@Injectable()
export class AuthGuard implements CanActivate {
	constructor(private readonly authService: AuthService) {}
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request =
			context.getType<string>() === 'graphql' ? context.getArgByIndex(2).req : context.switchToHttp().getRequest();
		const header = request.headers?.authorization;
		if (typeof header !== 'string' || !/^Bearer \S+$/.test(header)) throw new UnauthorizedException('UNAUTHORIZED');
		const member = await this.authService.verifyToken(header.slice(7));
		request.body ??= {};
		request.body.authMember = member;
		return true;
	}
}
