import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { RefreshSessionService, refreshHash, REFRESH_LIFETIME_MS } from '../components/auth/refresh-session.service';
import { AuthService } from '../components/auth/auth.service';
import { AuthResolver } from '../components/auth/auth.resolver';
import { MemberResolver } from '../components/member/member.resolver';
import { requireCookieRequest, refreshCookieOptions, refreshCookieName } from '../components/auth/auth-http';
const secret = 'unit-test-only-not-used-by-the-application';
function fixture() {
 const records:any[]=[];const member:any={_id:new Types.ObjectId(),memberType:'USER',memberStatus:'ACTIVE'};
 const matches=(r:any,q:any)=>Object.entries(q).every(([k,v]:any)=> v && typeof v==='object' && '$gt' in v ? r[k]>v.$gt : String(r[k]??'')===String(v??''));
 const sessions:any={
  create:jest.fn(async(value:any)=>{const array=Array.isArray(value)?value:[value];const result=array.map(v=>{const r={_id:new Types.ObjectId(),usedAt:null,revokedAt:null,...v};records.push(r);return r;});return Array.isArray(value)?result:result[0];}),
  findOne:(q:any)=>({session:async()=>records.find(r=>matches(r,q))}),
  updateOne:jest.fn(async(q:any,u:any)=>{const r=records.find(r=>matches(r,q));if(r)Object.assign(r,u.$set);return {modifiedCount:r?1:0};}),
  updateMany:jest.fn(async(q:any,u:any)=>{records.filter(r=>matches(r,q)).forEach(r=>Object.assign(r,u.$set));}),
  exists:async(q:any)=>records.find(r=>matches(r,q)),
 };
 const members:any={findById:()=>({session:async()=>member,lean:async()=>member})};
 const session={withTransaction:async(fn:any)=>fn(),endSession:async()=>{}};
 const jwt=new JwtService({secret});const auth=new AuthService(jwt,members,sessions);
 const service=new RefreshSessionService({startSession:async()=>session} as any,sessions,members,auth);
 return {service,records,member,sessions,jwt,auth};
}
describe('Rotating refresh authentication',()=>{
 const environment={...process.env};
 beforeEach(()=>{process.env.NODE_ENV='test';process.env.CORS_ORIGINS='http://localhost:3000';delete process.env.AUTH_COOKIE_SAME_SITE;});
 afterEach(()=>{process.env.NODE_ENV=environment.NODE_ENV; if(environment.CORS_ORIGINS)process.env.CORS_ORIGINS=environment.CORS_ORIGINS;else delete process.env.CORS_ORIGINS; if(environment.AUTH_COOKIE_SAME_SITE)process.env.AUTH_COOKIE_SAME_SITE=environment.AUTH_COOKIE_SAME_SITE;else delete process.env.AUTH_COOKIE_SAME_SITE;});
 it.each(['USER','SELLER','ADMIN','CS'])('login preserves %s and issues a cookie session',async role=>{
  const f=fixture();f.member.memberType=role;const members:any={login:jest.fn().mockResolvedValue(f.member)};
  const resolver=new MemberResolver(members,f.service);const res:any={cookie:jest.fn(),setHeader:jest.fn()};
  const result=await resolver.login({memberNick:'tester',memberPassword:'not-real'} as any,{req:{headers:{origin:'http://localhost:3000','x-kidify-csrf':'1'}} as any,res});
  expect(result.memberType).toBe(role);expect(result.accessToken).toBeTruthy();expect(res.cookie.mock.calls[0][2]).toMatchObject({httpOnly:true,sameSite:'lax',secure:false});expect(f.records).toHaveLength(1);
 });
 it('access expires at 15 minutes; only hashes are stored for a 30-day family',async()=>{
  const f=fixture();const issued=await f.service.issue(f.member);const payload:any=f.jwt.decode(issued.accessToken);
  expect(payload.exp-payload.iat).toBe(900);expect(issued.expiresAt.getTime()-Date.now()).toBeLessThanOrEqual(REFRESH_LIFETIME_MS);expect(issued.expiresAt.getTime()-Date.now()).toBeGreaterThan(REFRESH_LIFETIME_MS-2000);
  expect(f.records[0].tokenHash).toBe(refreshHash(issued.token));expect(JSON.stringify(f.records)).not.toContain(issued.token);
 });
 it('rejects expired access tokens',async()=>{
  const f=fixture();const expired=await f.jwt.signAsync({sub:String(f.member._id)},{expiresIn:-1});await expect(f.auth.verifyToken(expired)).rejects.toThrow();
 });
 it('rotates and rejects replay, committing family revocation',async()=>{
  const f=fixture();const first=await f.service.issue(f.member);const next=await f.service.rotate(first.token);
  expect(next.token).not.toBe(first.token);expect(f.records[0].usedAt).toBeTruthy();expect(next.expiresAt).toEqual(first.expiresAt);
  await expect(f.service.rotate(first.token)).rejects.toThrow();expect(f.records.every(r=>r.revokedAt)).toBe(true);
  await expect(f.service.rotate(next.token)).rejects.toThrow();await expect(f.auth.verifyToken(next.accessToken)).rejects.toThrow();
 });
 it('expired refresh and blocked member cannot rotate',async()=>{
  const f=fixture();const issued=await f.service.issue(f.member);f.records[0].expiresAt=new Date(0);await expect(f.service.rotate(issued.token)).rejects.toThrow();
  const other=await f.service.issue(f.member);f.member.memberStatus='BLOCK';await expect(f.service.rotate(other.token)).rejects.toThrow();
 });
 it('preserves the refresh cookie on transient storage failures, clears only invalid sessions',async()=>{
  const res:any={clearCookie:jest.fn(),setHeader:jest.fn()};
  const sessions:any={rotate:jest.fn().mockRejectedValue(new Error('Mongo temporarily unavailable'))};
  const context:any={req:{headers:{origin:'http://localhost:3000','x-kidify-csrf':'1'}},res};
  await expect(new AuthResolver(sessions).refreshToken(context)).rejects.toThrow('Mongo');
  expect(res.clearCookie).not.toHaveBeenCalled();
  sessions.rotate.mockRejectedValue(new UnauthorizedException());
  await expect(new AuthResolver(sessions).refreshToken(context)).rejects.toThrow();
  expect(res.clearCookie).toHaveBeenCalledTimes(1);
 });
 it('logout revokes the family and clears the identical cookie path',async()=>{
  const f=fixture();const issued=await f.service.issue(f.member);const res:any={clearCookie:jest.fn(),setHeader:jest.fn()};
  await new AuthResolver(f.service).logout({req:{headers:{origin:'http://localhost:3000','x-kidify-csrf':'1',cookie:`kidify_refresh=${issued.token}`}} as any,res});
  expect(res.clearCookie).toHaveBeenCalledWith('kidify_refresh',expect.objectContaining({path:'/',httpOnly:true}));await expect(f.service.rotate(issued.token)).rejects.toThrow();
 });
 it('rejects CSRF origins, missing headers, and configures secure host-only production cookies',()=>{
  expect(()=>requireCookieRequest({headers:{origin:'http://localhost:3000.evil.test','x-kidify-csrf':'1'}} as any)).toThrow();expect(()=>requireCookieRequest({headers:{origin:'http://localhost:3000'}} as any)).toThrow();
  process.env.NODE_ENV='production';process.env.CORS_ORIGINS='https://shop.example.com';expect(refreshCookieName()).toBe('__Host-kidify_refresh');expect(refreshCookieOptions()).toEqual({path:'/',httpOnly:true,secure:true,sameSite:'lax'});
 });
 it('refresh failure clears the cookie without exposing a token',async()=>{
  const f=fixture();const res:any={clearCookie:jest.fn(),setHeader:jest.fn()};await expect(new AuthResolver(f.service).refreshToken({req:{headers:{origin:'http://localhost:3000','x-kidify-csrf':'1'}} as any,res})).rejects.toThrow();expect(res.clearCookie).toHaveBeenCalled();
 });
});
