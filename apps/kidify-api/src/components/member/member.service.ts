import { lookupAuthMemberFollowed } from '../../libs/config';
import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";

import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import { SellerCodeService } from "../seller-code/seller-code.service";
import { atomic, escapeSearch } from "../../libs/marketplace";
import { InjectModel } from "@nestjs/mongoose";

import { ClientSession, Model, Types } from "mongoose";

import {
  SellersInquiry,
  LoginInput,
  MemberInput,
  MembersInquiry,
} from "../../libs/dto/member/member.input";

import { MemberStatus, MemberType } from "../../libs/enums/member.enum";

import { Direction, Message } from "../../libs/enums/common.enum";

import { AuthService } from "../auth/auth.service";

import { MemberUpdate } from "../../libs/dto/member/member.update";

import { StatisticModifier, T } from "../../libs/types/common";

import { ViewService } from "../view/view.service";

import { ViewGroup } from "../../libs/enums/view.enum";

import { Member, Members } from "../../libs/dto/member/member";

import { LikeInput } from "../../libs/dto/like/like.input";

import { LikeGroup } from "../../libs/enums/like.enum";

import { LikeService } from "../like/like.service";

import { Follower, Following, MeFollowed } from "../../libs/dto/follow/follow";
import { lookupAuthMemberLiked } from "../../libs/config";

@Injectable()
export class MemberService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly sellerCodes: SellerCodeService,
    @InjectModel("Member")
    private readonly memberModel: Model<Member>,

    @InjectModel("Follow")
    private readonly followModel: Model<Follower | Following>,

    private readonly authService: AuthService,

    private readonly viewService: ViewService,

    private readonly likeService: LikeService,
  ) {}

  // ========================= SIGNUP =========================

  public async signup(input: MemberInput): Promise<Member> {
    const memberPassword = await this.authService.hashPassword(
      input.memberPassword,
    );
    const data = {
      memberNick: input.memberNick,
      memberPhone: input.memberPhone,
      memberPassword,
      memberType: input.sellerCode ? MemberType.SELLER : MemberType.USER,
    };
    try {
      const result = input.sellerCode
        ? await atomic(this.connection, async (session) => {
            const [member] = await this.memberModel.create([data], { session });
            await this.sellerCodes.consume(
              input.sellerCode!,
              new Types.ObjectId(member._id),
              session,
            );
            return member;
          })
        : await this.memberModel.create(data);
      result.accessToken = await this.authService.createToken(result);
      result.memberPassword = undefined;
      return result;
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new BadRequestException(Message.USED_MEMBER_NICK_OR_PHONE);
      throw error;
    }
  }

  // ========================= LOGIN =========================

  public async login(input: LoginInput): Promise<Member> {
    const { memberNick, memberPassword } = input;

    const response = await this.memberModel
      .findOne({
        memberNick: memberNick,
      })
      .select("+memberPassword")
      .exec();

    if (!response || response.memberStatus === MemberStatus.DELETE) {
      throw new BadRequestException(Message.NO_MEMBER_NICK);
    }

    if (response.memberStatus === MemberStatus.BLOCK) {
      throw new BadRequestException(Message.BLOCKED_USER);
    }

    const isMatch = await this.authService.comparePassword(
      memberPassword,
      response.memberPassword!,
    );

    if (!isMatch) {
      throw new BadRequestException(Message.WRONG_PASSWORD);
    }

    response.accessToken = await this.authService.createToken(response);

    response.memberPassword = undefined;
    return response;
  }

  // ========================= UPDATE MEMBER =========================

  public async updateMember(
    memberId: Types.ObjectId,
    input: MemberUpdate,
  ): Promise<Member> {
    const allowed = [
      "memberNick",
      "memberPhone",
      "memberFullName",
      "memberImage",
      "memberAddress",
      "memberDesc",
    ];
    if (input.memberType || input.memberStatus || input.memberPassword)
      throw new ForbiddenException("PROTECTED_PROFILE_FIELD");
    const update = Object.fromEntries(
      Object.entries(input).filter(
        ([key, value]) => allowed.includes(key) && value !== undefined,
      ),
    );
    const result = await this.memberModel
      .findOneAndUpdate(
        {
          _id: memberId,
          memberStatus: MemberStatus.ACTIVE,
        },
        { $set: update },
        {
          new: true,
          runValidators: true,
        },
      )
      .exec();

    if (!result) {
      throw new InternalServerErrorException(Message.UPDATE_FAILED);
    }

    result.accessToken = await this.authService.createToken(result);

    return result;
  }

  // ========================= GET MEMBER =========================

  public async getMember(
    memberId: Types.ObjectId | null,
    targetId: Types.ObjectId,
  ): Promise<Member> {
    const search: T = {
      _id: targetId,
      memberStatus: {
        $in: [MemberStatus.ACTIVE, MemberStatus.BLOCK],
      },
    };

    const targetMember = await this.memberModel.findOne(search).lean().exec();

    if (!targetMember) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    if (memberId) {
      // ================= VIEW =================

      const viewInput = {
        memberId: memberId,
        viewRefId: targetId,
        viewGroup: ViewGroup.Member,
      };

      const newView = await this.viewService.recordView(viewInput);

      if (newView) {
        await this.memberModel
          .findOneAndUpdate(
            search,
            {
              $inc: {
                memberViews: 1,
              },
            },
            {
              new: true,
            },
          )
          .exec();

        targetMember.memberViews++;
      }

      // ================= LIKE =================

      const likeInput: LikeInput = {
        memberId: memberId,
        likeRefId: targetId,
        likeGroup: LikeGroup.MEMBER,
      };

      targetMember.meLiked =
        await this.likeService.checkLikeExistence(likeInput);

      // ================= FOLLOW =================

      targetMember.meFollowed = await this.checkSubscription(
        memberId,
        targetId,
      );
    }

    return this.publicMember(targetMember);
  }

  // ========================= CHECK SUBSCRIPTION =========================

  private async checkSubscription(
    followerId: Types.ObjectId,
    followingId: Types.ObjectId,
  ): Promise<MeFollowed[]> {
    const result = await this.followModel
      .findOne({
        followingId: followingId,
        followerId: followerId,
      })
      .exec();

    return result
      ? [
          {
            followerId: followerId,
            followingId: followingId,
            myFollowing: true,
          },
        ]
      : [];
  }

  // ========================= GET AGENTS =========================

  public async getSellers(
    memberId: Types.ObjectId,
    input: SellersInquiry,
  ): Promise<Members> {
    const { text } = input.search;

    const match: T = {
      memberType: MemberType.SELLER,

      memberStatus: MemberStatus.ACTIVE,
    };

    const sort: T = {
      [input?.sort ?? "createdAt"]: input?.direction ?? Direction.DESC,
    };

    if (text) {
      match.memberNick = {
        $regex: new RegExp(escapeSearch(text), "i"),
      };
    }


    const result = await this.memberModel
      .aggregate([
        {
          $match: match,
        },

        {
          $sort: sort,
        },

        {
          $facet: {
            list: [
              {
                $skip: (input.page - 1) * input.limit,
              },

              {
                $limit: input.limit,
              },
              lookupAuthMemberLiked(memberId),
              lookupAuthMemberFollowed({ followerId: memberId ?? null, followingId: '$_id' })(memberId),
            ],

            metaCounter: [
              {
                $count: "total",
              },
            ],
          },
        },
      ])
      .exec();


    if (!result.length) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    result[0].list = result[0].list.map((member: Member) =>
      this.publicMember(member),
    );
    return result[0];
  }

  // ========================= LIKE MEMBER =========================

  public async likeTargetMember(
    memberId: Types.ObjectId,
    likeRefId: Types.ObjectId,
  ): Promise<Member> {
    if (memberId.toString() === likeRefId.toString()) {
      throw new ForbiddenException("SELF_LIKE_DENIED");
    }
    const target = await this.memberModel
      .findOne({
        _id: likeRefId,
        memberStatus: MemberStatus.ACTIVE,
      })
      .exec();

    if (!target) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    const input: LikeInput = {
      memberId: memberId,
      likeRefId: likeRefId,
      likeGroup: LikeGroup.MEMBER,
    };

    // LIKE TOGGLE -1 / +1
    const modifier: number = await this.likeService.toggleLike(input);

    const result = await this.memberStatusEditor({
      _id: likeRefId,
      targetKey: "memberLikes",
      modifier: modifier,
    });

    if (!result) {
      throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
    }

    return result;
  }

  // ========================= GET ALL MEMBER BY ADMIN =========================

  public async getAllMemberByAdmin(input: MembersInquiry): Promise<Members> {
    const { memberStatus, memberType, text } = input.search;

    const match: T = {};

    const sort: T = {
      [input?.sort ?? "createdAt"]: input?.direction ?? Direction.DESC,
    };

    if (memberStatus) {
      match.memberStatus = memberStatus;
    }

    if (memberType) {
      match.memberType = memberType;
    }

    if (text) {
      match.memberNick = {
        $regex: new RegExp(escapeSearch(text), "i"),
      };
    }


    const result = await this.memberModel
      .aggregate([
        {
          $match: match,
        },

        {
          $sort: sort,
        },

        {
          $facet: {
            list: [
              {
                $skip: (input.page - 1) * input.limit,
              },

              {
                $limit: input.limit,
              },
            ],

            metaCounter: [
              {
                $count: "total",
              },
            ],
          },
        },
      ])
      .exec();


    if (!result.length) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    return result[0];
  }

  // ========================= UPDATE MEMBER BY ADMIN =========================

  public async updateMemberByAdmin(
    input: MemberUpdate,
    actorId?: Types.ObjectId,
  ): Promise<Member> {
    const { _id, memberType, memberStatus } = input;
    if (!_id) throw new BadRequestException("MEMBER_ID_REQUIRED");
    if (
      actorId &&
      String(_id) === String(actorId) &&
      ((memberStatus && memberStatus !== MemberStatus.ACTIVE) ||
        (memberType && memberType !== MemberType.ADMIN))
    )
      throw new BadRequestException("CANNOT_DISABLE_OWN_ADMIN");
    const update = {
      ...(memberType ? { memberType } : {}),
      ...(memberStatus ? { memberStatus } : {}),
      ...(memberStatus === MemberStatus.DELETE
        ? { deletedAt: new Date() }
        : {}),
    };
    const result = await this.memberModel
      .findByIdAndUpdate(
        _id,
        { $set: update },
        {
          new: true,
        },
      )
      .exec();

    if (!result) {
      throw new InternalServerErrorException(Message.UPDATE_FAILED);
    }

    return result;
  }

  // ========================= MEMBER STATUS EDITOR =========================

  public async memberStatusEditor(
    input: StatisticModifier,
    session?: ClientSession,
  ): Promise<Member> {
    const { _id, targetKey, modifier } = input;

    const result = await this.memberModel
      .findByIdAndUpdate(
        _id,
        {
          $inc: {
            [targetKey]: modifier,
          },
        },
        {
          new: true,
          session,
        },
      )
      .exec();

    if (!result) {
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    }

    return result;
  }
  publicMember(member: Member): Member {
    const safe = { ...member };
    delete safe.memberPassword;
    delete safe.accessToken;
    safe.memberPhone = undefined;
    safe.memberAddress = undefined;
    safe.memberFullName = undefined;
    return safe;
  }
  async getMe(memberId: Types.ObjectId): Promise<Member> {
    const member = await this.memberModel.findById(memberId).lean();
    if (!member) throw new NotFoundException("MEMBER_NOT_FOUND");
    return member;
  }
}
