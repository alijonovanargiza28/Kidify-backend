import { Types } from 'mongoose';
import { CouponService, couponDiscount } from '../components/coupon/coupon.service';
import { SellerCodeService } from '../components/seller-code/seller-code.service';
import { CouponStatus, DiscountType } from '../libs/enums/marketplace.enum';
import { validate } from 'class-validator';
import { BoardArticleInput } from '../libs/dto/board-article/board-article.input';
import { BoardArticleCategory } from '../libs/enums/board-article.enum';
describe('Creation validation and friendly duplicate handling', () => {
 const actor = new Types.ObjectId();
 const input:any={code:' summer ',discountType:DiscountType.PERCENT,discountValue:10};
 it('normalizes coupon codes and preserves the authenticated creator', async()=>{
  const model:any={create:jest.fn(async x=>x)};
  const value=await new CouponService(model).create(actor,input);
  expect(value.code).toBe('SUMMER');expect(value.createdBy).toBe(actor);
 });
 it('reports duplicate coupon codes without exposing Mongo errors',async()=>{
  const model:any={create:jest.fn().mockRejectedValue({code:11000})};
  await expect(new CouponService(model).create(actor,input)).rejects.toThrow('COUPON_CODE_ALREADY_EXISTS');
 });
 it('rejects blank codes, excessive percentages and inverted dates',()=>{
  const service=new CouponService({} as any);
  expect(()=>service.validate({...input,code:' '})).toThrow();
  expect(()=>service.validate({...input,discountValue:101})).toThrow();
  expect(()=>service.validate({...input,startAt:new Date(200),endAt:new Date(100)})).toThrow();
 });
 it('treats nullable unlimited usage as unlimited and rejects exhausted/disabled/expired coupons',()=>{
  const coupon:any={...input,status:CouponStatus.ACTIVE,usedCount:3,usageLimit:null};
  expect(couponDiscount(coupon,100)).toBe(10);
  expect(()=>couponDiscount({...coupon,usageLimit:3},100)).toThrow();
  expect(()=>couponDiscount({...coupon,status:CouponStatus.DISABLED},100)).toThrow();
  expect(()=>couponDiscount({...coupon,endAt:new Date(0)},100)).toThrow();
  expect(couponDiscount({...coupon,maximumDiscount:5},100)).toBe(5);
 });
 it('generates seller invitation codes, normalizes explicit codes and handles duplicates',async()=>{
  const model:any={create:jest.fn(async x=>x)};const service=new SellerCodeService(model);
  const generated=await service.create(actor,{});expect(generated.code).toMatch(/^[a-f0-9]{36}$/);expect(generated.createdBy).toBe(actor);
  expect((await service.create(actor,{code:' invite-123 '})).code).toBe('invite-123');
  await expect(service.create(actor,{code:'short'})).rejects.toThrow('SELLER_CODE_LENGTH');
  model.create.mockRejectedValue({code:11000});await expect(service.create(actor,{code:'invite-123'})).rejects.toThrow('SELLER_CODE_ALREADY_EXISTS');
 });
 it.each([undefined,'uploads/article/existing.png'])('accepts a permitted article with optional image %s',async articleImage=>{
  const article=Object.assign(new BoardArticleInput(),{articleCategory:Object.values(BoardArticleCategory)[0],articleTitle:'Article title',articleContent:'A valid article body.',articleImage});
  expect(await validate(article)).toHaveLength(0);
  article.articleContent='x'.repeat(251);expect((await validate(article)).some(e=>e.property==='articleContent')).toBe(true);
 });
});
