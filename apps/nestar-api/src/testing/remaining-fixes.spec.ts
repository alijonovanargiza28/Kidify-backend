import { Types } from 'mongoose';
import { FollowService } from '../components/follow/follow.service';
import { ReviewService } from '../components/review/review.service';
import { CommentService } from '../components/comment/comment.service';
import { MemberType } from '../libs/enums/member.enum';
import { ReviewGroup } from '../libs/enums/marketplace.enum';
const id = () => new Types.ObjectId();
const query = (value: any) => ({ session: jest.fn().mockResolvedValue(value) });
const session = { withTransaction: async (fn: any) => fn(session), endSession: jest.fn() };
const connection: any = { startSession: async () => session };
describe('Targeted follow and review permissions', () => {
 it('repeated subscribe returns the saved relation without incrementing counts or notifying', async () => {
  const saved = { _id: id() }; const follows: any = { findOne: () => query(saved), create: jest.fn() };
  const members: any = { findOne: () => query({}), updateOne: jest.fn() }; const notifications: any = { send: jest.fn() };
  const service = new FollowService(connection, members, notifications, follows, {} as any);
  expect(await service.subscribe(id(), id())).toBe(saved); expect(follows.create).not.toHaveBeenCalled(); expect(members.updateOne).not.toHaveBeenCalled(); expect(notifications.send).not.toHaveBeenCalled();
 });
 it('concurrent duplicate subscribe returns the committed relation without incrementing counters', async () => {
  const saved={_id:id()}; let reads=0;
  const follows:any={findOne:()=>++reads===1?query(null):Promise.resolve(saved),create:jest.fn().mockRejectedValue({code:11000})};
  const members:any={findOne:()=>query({}),updateOne:jest.fn()};
  const service=new FollowService(connection,members,{send:jest.fn()} as any,follows,{} as any);
  expect(await service.subscribe(id(),id())).toBe(saved); expect(members.updateOne).not.toHaveBeenCalled();
 });
 it('first follow changes both counters once', async () => {
  const follows: any = { findOne: () => query(null), create: jest.fn().mockResolvedValue([{}]) };
  const members: any = { findOne: () => query({}), updateOne: jest.fn() }; const notifications: any = { send: jest.fn() };
  await new FollowService(connection,members,notifications,follows,{} as any).subscribe(id(),id());
  expect(members.updateOne).toHaveBeenCalledTimes(2); expect(notifications.send).toHaveBeenCalledTimes(1);
 });
 it('already unfollowed is an idempotent no-op', async () => {
  const members: any = { updateOne: jest.fn() }; const follows: any = { findOneAndDelete: async () => null };
  expect(await new FollowService(connection,members,{} as any,follows,{} as any).unsubscribe(id(),id())).toBeNull(); expect(members.updateOne).not.toHaveBeenCalled();
 });
 it('seller may only reply to their own product review', async () => {
  const reviews: any = { findOne: async () => ({group:ReviewGroup.PRODUCT,targetId:id()}), findOneAndUpdate:jest.fn().mockResolvedValue({}) };
  const products: any = { exists:jest.fn().mockResolvedValue(false) };
  const service = new ReviewService({} as any,connection,reviews,{} as any,products,{} as any);
  const actor:any={_id:id(),memberType:MemberType.SELLER};
  await expect(service.reply(actor,id(),'Thanks')).rejects.toThrow('FORBIDDEN'); expect(reviews.findOneAndUpdate).not.toHaveBeenCalled();
  products.exists.mockResolvedValue(true); await service.reply(actor,id(),'Thanks'); expect(reviews.findOneAndUpdate).toHaveBeenCalledTimes(1);
 });
 it('authenticated buyer can like/unlike through the persistent unique like service', async () => {
  const likes:any={toggleLike:jest.fn().mockResolvedValue(-1)};
  const reviews:any={findOne:()=>query({}),findByIdAndUpdate:jest.fn().mockResolvedValue({likeCount:0})};
  const service=new ReviewService(likes,connection,reviews,{} as any,{} as any,{} as any);
  await service.like({_id:id(),memberType:MemberType.USER} as any,id()); expect(likes.toggleLike).toHaveBeenCalledTimes(1); expect(reviews.findByIdAndUpdate.mock.calls[0][1]).toEqual({$inc:{likeCount:-1}});
 });
 it('rejects review without the exact delivered paid order before inserting',async()=>{
  const reviews:any={create:jest.fn()}; const orders:any={findOne:jest.fn(()=>query(null))};
  const service=new ReviewService({} as any,connection,reviews,orders,{} as any,{} as any);
  await expect(service.create(id(),{group:ReviewGroup.PRODUCT,targetId:id().toString(),orderId:id().toString(),rating:5,text:'Review'})).rejects.toThrow();
  expect(orders.findOne.mock.calls[0][0]).toMatchObject({status:'DELIVERED',paymentStatus:'PAID'}); expect(reviews.create).not.toHaveBeenCalled();
 });
 it('rejects product comments without a delivered paid purchase',async()=>{
  const comments:any={create:jest.fn()}; const orders:any={findOne:()=>query(null)}; const products:any={findOne:()=>query({})};
  const service=new CommentService({} as any,orders,connection,products,{} as any,{} as any,comments,{} as any,{} as any,{} as any);
  await expect(service.createComment(id(),{commentGroup:'PRODUCT',commentRefId:id(),commentContent:'Hello'} as any)).rejects.toThrow('PURCHASE_REQUIRED_FOR_REVIEW');expect(comments.create).not.toHaveBeenCalled();
 });
});
