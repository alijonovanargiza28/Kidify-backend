import { Request, Response } from 'express';
import { RefreshSessionService } from '../auth/refresh-session.service';
import { requireCookieRequest, readRefreshCookie, writeRefreshCookie } from '../auth/auth-http';
import { uploadImage } from "../../libs/upload";
import { unlink } from "fs/promises";
import {
  Args,
  Mutation,
  Query,
  Resolver,
  ResolveField,
  Parent,
  Context,
} from "@nestjs/graphql";
import { BadRequestException, UseGuards } from "@nestjs/common";
import mongoose from "mongoose";

import { MemberService } from "./member.service";

import {
  SellersInquiry,
  LoginInput,
  MemberInput,
  MembersInquiry,
} from "../../libs/dto/member/member.input";

import { Message } from "../../libs/enums/common.enum";

import { AuthGuard } from "../auth/guards/auth.guard";
import { AuthMember } from "../auth/decorators/authMember.decorator";

import { MemberType } from "../../libs/enums/member.enum";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";

import { MemberUpdate } from "../../libs/dto/member/member.update";

import {
  getSerialForImage,
  shapeIntoMongoObjectId,
  validMimeTypes,
} from "../../libs/config";

import { WithoutGuard } from "../auth/guards/without.guard";

import { GraphQLUpload, FileUpload } from "graphql-upload";

import { createWriteStream } from "fs";

import { Member, Members } from "../../libs/dto/member/member";

@Resolver(() => Member)
export class MemberResolver {
  constructor(private readonly memberService: MemberService, private readonly refreshSessions: RefreshSessionService) {}

  private privateField(
    parent: Member,
    context: { req: { body?: { authMember?: Member } } },
    field: keyof Member,
  ) {
    const actor = context.req.body?.authMember;
    return actor &&
      (actor.memberType === MemberType.ADMIN ||
        String(actor._id) === String(parent._id))
      ? (parent[field] ?? null)
      : null;
  }
  @ResolveField(() => String, { nullable: true }) memberPhone(
    @Parent() parent: Member,
    @Context() context: { req: { body?: { authMember?: Member } } },
  ) {
    return this.privateField(parent, context, "memberPhone");
  }
  @ResolveField(() => String, { nullable: true }) memberAddress(
    @Parent() parent: Member,
    @Context() context: { req: { body?: { authMember?: Member } } },
  ) {
    return this.privateField(parent, context, "memberAddress");
  }
  @ResolveField(() => String, { nullable: true }) memberFullName(
    @Parent() parent: Member,
    @Context() context: { req: { body?: { authMember?: Member } } },
  ) {
    return this.privateField(parent, context, "memberFullName");
  }

  // ========================= SIGNUP =========================

  @Mutation(() => Member)
  public async signup(@Args("input") input: MemberInput, @Context() context: { req: Request; res: Response }): Promise<Member> {
    console.log("Mutation: signup");

    requireCookieRequest(context.req);
    const member = await this.memberService.signup(input);
    await this.refreshSessions.revoke(readRefreshCookie(context.req));
    const session = await this.refreshSessions.issue(member);
    writeRefreshCookie(context.res, session.token, session.expiresAt);
    member.accessToken = session.accessToken;
    return member;
  }

  // ========================= LOGIN =========================

  @Mutation(() => Member)
  public async login(@Args("input") input: LoginInput, @Context() context: { req: Request; res: Response }): Promise<Member> {
    console.log("Mutation: login");

    requireCookieRequest(context.req);
    const member = await this.memberService.login(input);
    await this.refreshSessions.revoke(readRefreshCookie(context.req));
    const session = await this.refreshSessions.issue(member);
    writeRefreshCookie(context.res, session.token, session.expiresAt);
    member.accessToken = session.accessToken;
    return member;
  }

  // ========================= CHECK AUTH =========================

  @UseGuards(AuthGuard)
  @Query(() => String)
  public async checkAuth(
    @AuthMember("memberNick")
    memberNick: string,
  ): Promise<string> {
    console.log("Query: checkAuth");
    console.log("memberNick:", memberNick);

    return `Hi ${memberNick}`;
  }

  // ========================= CHECK AUTH ROLES =========================

  @Roles(MemberType.USER, MemberType.SELLER)
  @UseGuards(RolesGuard)
  @Query(() => String)
  public async checkAuthRoles(
    @AuthMember() authMember: Member,
  ): Promise<string> {
    console.log("Query: checkAuthRoles");

    return `HI ${authMember.memberNick}, you are ${authMember.memberType} (memberId: ${authMember._id})`;
  }

  // ========================= UPDATE MEMBER =========================

  @UseGuards(AuthGuard)
  @Mutation(() => Member)
  public async updateMember(
    @Args("input") input: MemberUpdate,
    @AuthMember("_id")
    memberId: mongoose.Types.ObjectId,
  ): Promise<Member> {
    console.log("Mutation: updateMember");

    delete input._id;

    return await this.memberService.updateMember(memberId, input);
  }

  // ========================= GET MEMBER =========================

  @UseGuards(WithoutGuard)
  @Query(() => Member)
  public async getMember(
    @Args("memberId") input: string,
    @AuthMember("_id")
    memberId: mongoose.Types.ObjectId,
  ): Promise<Member> {
    console.log("Query: getMember");

    const targetId = shapeIntoMongoObjectId(input);

    return await this.memberService.getMember(memberId, targetId);
  }

  @UseGuards(AuthGuard)
  @Query(() => Member)
  getMe(@AuthMember("_id") memberId: mongoose.Types.ObjectId) {
    return this.memberService.getMe(memberId);
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  logout() {
    return true;
  } // Stateless JWT: client discards its token.

  @UseGuards(WithoutGuard)
  @Query(() => Members)
  getSellers(
    @Args("input") input: SellersInquiry,
    @AuthMember("_id") memberId: mongoose.Types.ObjectId,
  ) {
    return this.memberService.getSellers(memberId, input);
  }

  @UseGuards(WithoutGuard)
  @Query(() => Member)
  async getSeller(
    @Args("sellerId") input: string,
    @AuthMember("_id") memberId: mongoose.Types.ObjectId,
  ) {
    const seller = await this.memberService.getMember(
      memberId,
      shapeIntoMongoObjectId(input),
    );
    if (
      seller.memberType !== MemberType.SELLER ||
      seller.memberStatus !== "ACTIVE"
    )
      throw new Error("SELLER_NOT_FOUND");
    return seller;
  }

  // ========================= LIKE MEMBER =========================

  @UseGuards(AuthGuard)
  @Mutation(() => Member)
  public async likeTargetMember(
    @Args("memberId") input: string,
    @AuthMember("_id")
    memberId: mongoose.Types.ObjectId,
  ): Promise<Member> {
    console.log("Mutation: LikeTargetMember");

    const likeRefId = shapeIntoMongoObjectId(input);

    return await this.memberService.likeTargetMember(memberId, likeRefId);
  }

  // ========================= ADMIN =========================

  @Roles(MemberType.ADMIN)
  @UseGuards(RolesGuard)
  @Query(() => Members)
  public async getAllMemberByAdmin(
    @Args("input") input: MembersInquiry,
  ): Promise<Members> {
    console.log("Query: getAllMemberByAdmin");

    return await this.memberService.getAllMemberByAdmin(input);
  }

  // ========================= ADMIN UPDATE =========================

  @Roles(MemberType.ADMIN)
  @UseGuards(RolesGuard)
  @Mutation(() => Member)
  public async updateMemberByAdmin(
    @Args("input") input: MemberUpdate,
    @AuthMember("_id") actorId: mongoose.Types.ObjectId,
  ): Promise<Member> {
    console.log("Mutation: updateMemberByAdmin");

    return await this.memberService.updateMemberByAdmin(input, actorId);
  }

  @UseGuards(AuthGuard)
  @Mutation(() => String)
  imageUploader(
    @Args({ name: "file", type: () => GraphQLUpload }) file: FileUpload,
    @Args("target") target: string,
    @AuthMember("memberType") role: MemberType,
  ) {
    return uploadImage(file, target, role);
  }
  @UseGuards(AuthGuard)
  @Mutation(() => [String])
  async imagesUploader(
    @Args("files", { type: () => [GraphQLUpload] })
    files: Promise<FileUpload>[],
    @Args("target") target: string,
    @AuthMember("memberType") role: MemberType,
  ) {
    if (!files.length || files.length > 10)
      throw new BadRequestException("INVALID_FILE_COUNT");
    const paths: string[] = [];
    try {
      for (const file of files)
        paths.push(await uploadImage(await file, target, role));
    } catch (error) {
      await Promise.all(
        paths.map((path) => unlink(path).catch(() => undefined)),
      );
      throw error;
    }
    return paths;
  }
}
