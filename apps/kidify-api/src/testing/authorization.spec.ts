import { INestApplication, ForbiddenException } from '@nestjs/common';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { graphql, GraphQLSchema } from 'graphql';
import { createOfflineApp } from './offline-app';
import { AuthService } from '../components/auth/auth.service';
import { MemberService } from '../components/member/member.service';
import { Member } from '../libs/dto/member/member';
import { MemberType, MemberStatus, MemberAuthType } from '../libs/enums/member.enum';
import { DashboardService } from '../components/dashboard/dashboard.service';
import { SellerCodeService } from '../components/seller-code/seller-code.service';
import { ProductService } from '../components/product/product.service';
import { RefreshSessionService } from '../components/auth/refresh-session.service';
import { ReviewService } from '../components/review/review.service';
import { SupportService } from '../components/support/support.service';
const id = new Types.ObjectId().toHexString();
const stranger = new Types.ObjectId().toHexString();
const member = (role = MemberType.USER): Member => ({
	_id: id,
	memberType: role,
	memberStatus: MemberStatus.ACTIVE,
	memberAuthType: MemberAuthType.PHONE,
	memberNick: 'tester',
	memberPhone: 'private-phone',
	memberAddress: 'private-address',
	memberFullName: 'private-name',
	memberProducts: 0,
	memberSales: 0,
	memberReviews: 0,
	averageRating: 0,
	memberProperties: 0,
	memberArticles: 0,
	memberFollowers: 0,
	memberFollowings: 0,
	memberLikes: 0,
	memberViews: 0,
	memberComments: 0,
	memberPoints: 0,
	memberRank: 0,
	memberWarnings: 0,
	memberBlocks: 0,
	createdAt: new Date(),
	updatedAt: new Date(),
});
describe('Real GraphQL authorization and privacy', () => {
	let app: INestApplication, schema: GraphQLSchema;
	let identity: Member;
	beforeAll(async () => {
		app = await createOfflineApp();
		schema = app.get(GraphQLSchemaHost).schema;
	}, 20000);
	beforeEach(() => {
		identity = member();
		jest.spyOn(app.get(AuthService), 'verifyToken').mockImplementation(async () => identity);
	});
	afterEach(() => jest.restoreAllMocks());
	afterAll(async () => {
		if (app) {
			await app.get<Connection>(getConnectionToken()).destroy();
			await app.close();
		}
	});
	const run = (source: string, token = true) =>
		graphql({
			schema,
			source,
			contextValue: { req: { headers: token ? { authorization: 'Bearer token' } : {}, body: {} } },
		});
	it('routes GraphQL logout to cookie-session revocation without a Bearer token', async () => {
        const previousOrigins = process.env.CORS_ORIGINS;
        process.env.CORS_ORIGINS = 'http://localhost:3016';
        const revoke = jest.spyOn(app.get(RefreshSessionService), 'revoke').mockResolvedValue(undefined);
        const clearCookie = jest.fn(), setHeader = jest.fn();
        const token = 'a'.repeat(64);
        try {
            const result = await graphql({schema, source: 'mutation LogoutKidifySession { logout }', contextValue: {
                req: {headers: {origin: 'http://localhost:3016', 'x-kidify-csrf': '1', cookie: `kidify_refresh=${token}`}},
                res: {clearCookie, setHeader},
            }});
            expect(result.errors).toBeUndefined();
            expect(result.data?.logout).toBe(true);
            expect(revoke).toHaveBeenCalledWith(token);
            expect(clearCookie).toHaveBeenCalledWith('kidify_refresh', expect.objectContaining({path: '/', httpOnly: true}));
            expect(app.get(AuthService).verifyToken).not.toHaveBeenCalled();
            revoke.mockClear();
            const rejected = await graphql({schema, source: 'mutation { logout }', contextValue: {
                req: {headers: {origin: 'https://untrusted.example', 'x-kidify-csrf': '1'}}, res: {clearCookie, setHeader},
            }});
            expect(rejected.errors?.[0].message).toBe('CSRF_VALIDATION_FAILED');
            expect(revoke).not.toHaveBeenCalled();
        } finally {
            if (previousOrigins === undefined) delete process.env.CORS_ORIGINS;
            else process.env.CORS_ORIGINS = previousOrigins;
        }
    });
	it.each([MemberType.USER, MemberType.SELLER, MemberType.CS])('%s cannot access the admin dashboard', async (role) => {
		identity = member(role);
		const call = jest.spyOn(app.get(DashboardService), 'admin');
		const result = await run('{ getAdminDashboard { totalUsers } }');
		expect(result.errors?.[0].message).toBe('FORBIDDEN');
		expect(call).not.toHaveBeenCalled();
	});

    it.each([MemberType.USER,MemberType.SELLER,MemberType.CS])('%s cannot remove product or seller reviews',async role=>{
        identity=member(role);
        const remove=jest.spyOn(app.get(ReviewService),'remove');
        const result=await run(`mutation { removeReviewByAdmin(reviewId:"${id}") { _id } }`);
        expect(result.errors?.[0].message).toBe('FORBIDDEN');
        expect(remove).not.toHaveBeenCalled();
    });
    it('allows ADMIN to remove a review through the real GraphQL permission guard',async()=>{
        identity=member(MemberType.ADMIN);
        const remove=jest.spyOn(app.get(ReviewService),'remove').mockResolvedValue({_id:id} as any);
        const result=await run(`mutation { removeReviewByAdmin(reviewId:"${id}") { _id } }`);
        expect(result.errors).toBeUndefined();expect(result.data?.removeReviewByAdmin).toEqual({_id:id});
        expect(remove).toHaveBeenCalledWith(new Types.ObjectId(id));
    });
	it('class-level ADMIN roles protect SellerCode queries', async () => {
		const call = jest.spyOn(app.get(SellerCodeService), 'list');
		const result = await run('{ getSellerCodes(input: {}) { list { code } } }');
		expect(result.errors?.[0].message).toBe('FORBIDDEN');
		expect(call).not.toHaveBeenCalled();
	});
	it('USER cannot create articles', async () => {
		const result = await run(
			'mutation { createBoardArticle(input: {articleCategory: TIPS, articleTitle: "Test title", articleContent: "Article content"}) { _id } }',
		);
		expect(result.errors?.[0].message).toBe('FORBIDDEN');
	});
	it('USER cannot call seller-only queries', async () => {
		const call = jest.spyOn(app.get(ProductService), 'list');
		const result = await run('{ getMyProducts(input: {}) { list { _id } } }');
		expect(result.errors?.[0].message).toBe('FORBIDDEN');
		expect(call).not.toHaveBeenCalled();
	});
	it('anonymous cannot access a cart', async () => {
		expect((await run('{ getMyCart { _id } }', false)).errors?.[0].message).toBe('UNAUTHORIZED');
	});
	it('blocks a token whose account is blocked', async () => {
		jest.spyOn(app.get(AuthService), 'verifyToken').mockRejectedValue(new ForbiddenException('BLOCKED_MEMBER'));
		expect((await run('{ getMe { _id } }')).errors?.[0].message).toBe('BLOCKED_MEMBER');
	});
	it('public nested Member fields hide phone, address and full name', async () => {
		jest.spyOn(app.get(MemberService), 'getMember').mockResolvedValue({ ...member(), _id: stranger });
		const result = await run(
			`{ getMember(memberId: "${stranger}") { memberPhone memberAddress memberFullName memberNick } }`,
			false,
		);
		expect(result.errors).toBeUndefined();
		expect(result.data?.getMember).toEqual({
			memberPhone: null,
			memberAddress: null,
			memberFullName: null,
			memberNick: 'tester',
		});
	});
	it('getMe derives identity from the token and reveals own contact fields', async () => {
		const get = jest.spyOn(app.get(MemberService), 'getMe').mockResolvedValue(member());
		const result = await run('{ getMe { _id memberPhone } }');
		expect(result.errors).toBeUndefined();
		expect(String(get.mock.calls[0][0])).toBe(id);
		expect(result.data?.getMe).toEqual({ _id: id, memberPhone: 'private-phone' });
	});
	it('CS support scope is assigned tickets, not unrestricted admin scope', () => {
		expect(app.get(SupportService).access(member(MemberType.CS))).toEqual({ assignedCS: id });
		expect(app.get(SupportService).access(member())).toEqual({ creatorId: id });
		expect(app.get(SupportService).access(member(MemberType.ADMIN))).toEqual({});
	});
	it('profile role and password updates are rejected before persistence', async () => {
		const update = jest.spyOn(app.get<Model<Member>>(getModelToken('Member')), 'findOneAndUpdate');
		const result = await run(`mutation { updateMember(input: {_id: "${id}", memberType: ADMIN}) { _id } }`);
		expect(result.errors?.[0].message).toBe('PROTECTED_PROFILE_FIELD');
		expect(update).not.toHaveBeenCalled();
	});
	it('AuthService verifies the stored role/status instead of embedded JWT privileges', async () => {
		jest.restoreAllMocks();
		const auth = app.get(AuthService);
		const token = await auth.createToken(member(MemberType.ADMIN));
		jest
			.spyOn(app.get<Model<Member>>(getModelToken('Member')), 'findById')
			.mockReturnValue({ lean: async () => member(MemberType.USER) } as unknown as ReturnType<
				Model<Member>['findById']
			>);
		expect((await auth.verifyToken(token)).memberType).toBe(MemberType.USER);
	});
	it('AuthService rejects a blocked account even with a previously issued token', async () => {
		jest.restoreAllMocks();
		const auth = app.get(AuthService),
			token = await auth.createToken(member());
		jest
			.spyOn(app.get<Model<Member>>(getModelToken('Member')), 'findById')
			.mockReturnValue({
				lean: async () => ({ ...member(), memberStatus: MemberStatus.BLOCK }),
			} as unknown as ReturnType<Model<Member>['findById']>);
		await expect(auth.verifyToken(token)).rejects.toThrow('BLOCKED_MEMBER');
	});
});
