import { Types } from 'mongoose';
import { MemberService } from '../components/member/member.service';
import { FollowService } from '../components/follow/follow.service';

describe('Member self actions', () => {
 it('rejects self likes before reading or changing data', async () => {
  const id = new Types.ObjectId();
  const members: any = { findOne: jest.fn(), findOneAndUpdate: jest.fn() };
  const likes: any = { toggleLike: jest.fn() };
  const service = new MemberService({} as any, {} as any, members, {} as any, {} as any, {} as any, likes);
  await expect(service.likeTargetMember(id, new Types.ObjectId(id.toString()))).rejects.toThrow('SELF_LIKE_DENIED');
  expect(members.findOne).not.toHaveBeenCalled();
  expect(members.findOneAndUpdate).not.toHaveBeenCalled();
  expect(likes.toggleLike).not.toHaveBeenCalled();
 });
 it('rejects self follows before opening a transaction or changing data', async () => {
  const id = new Types.ObjectId();
  const connection: any = { startSession: jest.fn() };
  const follows: any = { create: jest.fn() };
  const service = new FollowService(connection, {} as any, {} as any, follows, {} as any);
  await expect(service.subscribe(id, new Types.ObjectId(id.toString()))).rejects.toThrow();
  expect(connection.startSession).not.toHaveBeenCalled();
  expect(follows.create).not.toHaveBeenCalled();
 });
});
