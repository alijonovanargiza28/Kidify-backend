import { Types } from 'mongoose';
import { OrderService, parentPreparation } from '../components/order/order.service';
import { OrderStatus, PaymentStatus } from '../libs/enums/marketplace.enum';
import { MemberType } from '../libs/enums/member.enum';
import { CommentService } from '../components/comment/comment.service';
const id=()=>new Types.ObjectId();
const query=(value:any)=>({session:async()=>value});
const session={withTransaction:async(fn:any)=>fn(session),endSession:jest.fn()};
const connection:any={startSession:async()=>session};
describe('Seller fulfillment and authorized comments',()=>{
 function setup(status=OrderStatus.READY_FOR_DELIVERY){
  const seller=id(),other=id();
  const item={_id:id(),sellerId:seller,productId:id(),status,quantity:1};
  const order:any={_id:id(),memberId:id(),paymentStatus:PaymentStatus.PAID,status,items:[item,{_id:id(),sellerId:other,status:OrderStatus.PREPARING}],save:jest.fn()};
  const products:any={updateOne:jest.fn()},members:any={updateOne:jest.fn()};
  const service=new OrderService(connection,{findOne:()=>query(order)} as any,{} as any,products,{} as any,{} as any,{updateOne:jest.fn()} as any,members,{} as any,{} as any,{} as any,{} as any,{send:jest.fn()} as any);
  return {service,order,item,seller,other,products,members};
 }
 it('ships only the seller item and keeps the parent at the slowest stage',async()=>{
  const s=setup();await s.service.prepare(s.seller,s.order._id,s.item._id,OrderStatus.SHIPPED);
  expect(s.item.status).toBe(OrderStatus.SHIPPED);expect(s.order.items[1].status).toBe(OrderStatus.PREPARING);expect(s.order.status).toBe(OrderStatus.PREPARING);expect(s.products.updateOne).not.toHaveBeenCalled();
 });
 it('rejects another seller item and skipped transitions',async()=>{
  const s=setup();await expect(s.service.prepare(s.other,s.order._id,s.item._id,OrderStatus.SHIPPED)).rejects.toThrow();await expect(s.service.prepare(s.seller,s.order._id,s.item._id,OrderStatus.DELIVERED)).rejects.toThrow();expect(s.order.save).not.toHaveBeenCalled();
 });
 it('delivers and credits sales once, with no second stock deduction',async()=>{
  const s=setup(OrderStatus.SHIPPED);await s.service.prepare(s.seller,s.order._id,s.item._id,OrderStatus.DELIVERED);
  expect(s.products.updateOne).toHaveBeenCalledTimes(1);expect(s.products.updateOne.mock.calls[0][1]).toEqual({$inc:{productSales:1,productRank:5}});
  await expect(s.service.prepare(s.seller,s.order._id,s.item._id,OrderStatus.DELIVERED)).rejects.toThrow();expect(s.products.updateOne).toHaveBeenCalledTimes(1);
 });
 it('recognizes a fully delivered multi-seller order',()=>expect(parentPreparation([{status:OrderStatus.DELIVERED},{status:OrderStatus.DELIVERED}])).toBe(OrderStatus.DELIVERED));
 it.each([MemberType.ADMIN,MemberType.SELLER])('allows authorized %s comments without a false purchase badge',async role=>{
  const actor:any={_id:id(),memberType:role};const comments:any={create:jest.fn().mockResolvedValue([{}])};
  const service=new CommentService({} as any,{findOne:()=>query(null)} as any,connection,{findOne:()=>query({productSellerId:actor._id}),updateOne:jest.fn()} as any,{} as any,{send:jest.fn()} as any,comments,{} as any,{} as any,{} as any);
  await service.createComment(actor._id,{commentGroup:'PRODUCT',commentRefId:id(),commentContent:'Thank you'} as any,actor);expect(comments.create.mock.calls[0][0][0].verifiedPurchase).toBe(false);
 });
 it('rejects unrelated seller comments',async()=>{
  const actor:any={_id:id(),memberType:MemberType.SELLER};const comments:any={create:jest.fn()};
  const service=new CommentService({} as any,{findOne:()=>query(null)} as any,connection,{findOne:()=>query({productSellerId:id()})} as any,{} as any,{} as any,comments,{} as any,{} as any,{} as any);
  await expect(service.createComment(actor._id,{commentGroup:'PRODUCT',commentRefId:id(),commentContent:'Hi'} as any,actor)).rejects.toThrow();expect(comments.create).not.toHaveBeenCalled();
 });
 it('refund restores each reserved variant exactly once and rejects a repeated refund',async()=>{
  const item:any={_id:id(),productId:id(),variantId:id(),sellerId:id(),quantity:2,status:OrderStatus.DELIVERED};
  const order:any={_id:id(),memberId:id(),status:OrderStatus.DELIVERED,paymentStatus:PaymentStatus.PAID,items:[item],save:jest.fn()}; order.toObject=()=>order;
  const products:any={updateOne:jest.fn()},members:any={updateOne:jest.fn()};
  const service=new OrderService(connection,{findById:()=>query(order)} as any,{} as any,products,{} as any,{updateOne:jest.fn()} as any,{updateOne:jest.fn()} as any,members,{} as any,{} as any,{} as any,{} as any,{send:jest.fn()} as any);
  const actor:any={_id:id(),memberType:MemberType.ADMIN};
  await service.adminStatus(actor,order._id,OrderStatus.REFUNDED);
  expect(products.updateOne.mock.calls.filter((c:any)=>c[1].$inc?.['productVariants.$.stock'])).toHaveLength(1);
  expect(products.updateOne.mock.calls[0][1].$inc['productVariants.$.stock']).toBe(2);
  await expect(service.adminStatus(actor,order._id,OrderStatus.REFUNDED)).rejects.toThrow();
  expect(products.updateOne.mock.calls.filter((c:any)=>c[1].$inc?.['productVariants.$.stock'])).toHaveLength(1);
 });

});
