import { UnauthorizedException } from '@nestjs/common';
import { Resolver, Mutation, Context, ObjectType, Field } from '@nestjs/graphql';
import { Request, Response } from 'express';
import { RefreshSessionService } from './refresh-session.service';
import { requireCookieRequest, readRefreshCookie, writeRefreshCookie, clearRefreshCookie } from './auth-http';
@ObjectType()
export class RefreshedAuth {
  @Field(() => String) accessToken!: string;
}
@Resolver()
export class AuthResolver {
  constructor(private readonly sessions: RefreshSessionService) {}
  @Mutation(() => RefreshedAuth)
  async refreshToken(@Context() context: { req: Request; res: Response }) {
    requireCookieRequest(context.req);
    try {
      const result = await this.sessions.rotate(readRefreshCookie(context.req));
      writeRefreshCookie(context.res, result.token, result.expiresAt);
      return { accessToken: result.accessToken };
    } catch (error) { if (error instanceof UnauthorizedException) clearRefreshCookie(context.res); throw error; }
  }
  @Mutation(() => Boolean)
  async logout(@Context() context: { req: Request; res: Response }) {
    requireCookieRequest(context.req);
    try { await this.sessions.revoke(readRefreshCookie(context.req)); }
    finally { clearRefreshCookie(context.res); }
    return true;
  }
}
