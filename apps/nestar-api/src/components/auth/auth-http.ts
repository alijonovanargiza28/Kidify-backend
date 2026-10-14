import { ForbiddenException } from '@nestjs/common';
import { Request, Response, CookieOptions } from 'express';
export function authOrigins(): string[] {
  const configured = process.env.CORS_ORIGINS;
  if (!configured && process.env.NODE_ENV === 'production') throw new Error('CORS_ORIGINS is required in production');
  const origins = (configured || 'http://localhost:3000,http://localhost:3001,http://localhost:3016').split(',').map(s => s.trim()).filter(Boolean);
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) || (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')) throw new Error('CORS_ORIGINS must contain exact allowed origins (HTTPS in production)');
  }
  return origins;
}
export function requireCookieRequest(req: Request) {
  // A custom header forces preflight; an exact Origin check prevents login/refresh CSRF.
  if (!req.headers.origin || !authOrigins().includes(req.headers.origin) || req.headers['x-kidify-csrf'] !== '1') throw new ForbiddenException('CSRF_VALIDATION_FAILED');
}
export const refreshCookieName = () => process.env.NODE_ENV === 'production' ? '__Host-kidify_refresh' : 'kidify_refresh';
export function refreshCookieOptions(): CookieOptions {
  const production = process.env.NODE_ENV === 'production';
  const sameSite = process.env.AUTH_COOKIE_SAME_SITE || 'lax';
  if (!['lax','strict','none'].includes(sameSite) || (sameSite === 'none' && !production)) throw new Error('Invalid AUTH_COOKIE_SAME_SITE configuration');
  return { httpOnly: true, secure: production, sameSite: sameSite as 'lax' | 'strict' | 'none', path: '/' };
}
export function readRefreshCookie(req: Request): string | undefined {
  const entries = (req.headers.cookie || '').split(';').map(s => s.trim()).filter(s => s.startsWith(refreshCookieName() + '='));
  if (entries.length !== 1) return undefined;
  const token = entries[0].slice(refreshCookieName().length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}
export function writeRefreshCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(refreshCookieName(), token, { ...refreshCookieOptions(), expires: expiresAt, maxAge: Math.max(0, expiresAt.getTime() - Date.now()) });
  res.setHeader('Cache-Control', 'no-store');
}
export function clearRefreshCookie(res: Response) {
  res.clearCookie(refreshCookieName(), refreshCookieOptions());
  res.setHeader('Cache-Control', 'no-store');
}
