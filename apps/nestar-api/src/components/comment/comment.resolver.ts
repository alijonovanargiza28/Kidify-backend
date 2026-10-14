import { Member } from '../../libs/dto/member/member';
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import mongoose from "mongoose";

import { CommentService } from "./comment.service";
import { AuthGuard } from "../auth/guards/auth.guard";

import { Comment, Comments } from "../../libs/dto/comment/comment";
import {
  CommentInput,
  CommentsInquiry,
} from "../../libs/dto/comment/comment.input";

import { AuthMember } from "../auth/decorators/authMember.decorator";
import { CommentUpdate } from "../../libs/dto/comment/comment.update";
import { shapeIntoMongoObjectId } from "../../libs/config";

import { WithoutGuard } from "../auth/guards/without.guard";
import { MemberType } from "../../libs/enums/member.enum";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@Resolver()
export class CommentResolver {
  constructor(private readonly commentService: CommentService) {}

  @UseGuards(AuthGuard)
  @Mutation(() => Comment)
  likeComment(@Args('commentId') id: string, @AuthMember('_id') memberId: mongoose.Types.ObjectId) {
    return this.commentService.likeComment(memberId, shapeIntoMongoObjectId(id));
  }
  @UseGuards(AuthGuard)
  @Mutation(() => Comment)
  replyComment(@Args('commentId') id: string, @Args('text') text: string, @AuthMember() actor: Member) {
    return this.commentService.replyComment(actor, shapeIntoMongoObjectId(id), text);
  }
  @UseGuards(AuthGuard)
  @Mutation(() => Comment)
  public async createComment(
    @Args("input") input: CommentInput,
    @AuthMember() actor: Member,
  ): Promise<Comment> {
    console.log("Mutation: CreateComment");

    return await this.commentService.createComment(shapeIntoMongoObjectId(actor._id), input, actor);
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Comment)
  public async updateComment(
    @Args("input") input: CommentUpdate,
    @AuthMember("_id") memberId: mongoose.Types.ObjectId,
  ): Promise<Comment> {
    console.log("Mutation: updateComment");

    return await this.commentService.updateComment(memberId, input);
  }

  @UseGuards(WithoutGuard)
  @Query(() => Comments)
  public async getComments(
    @Args("input") input: CommentsInquiry,
    @AuthMember("_id") memberId: mongoose.Types.ObjectId,
  ): Promise<Comments> {
    console.log("Query: getComments");

    input.search.commentRefId = shapeIntoMongoObjectId(
      input.search.commentRefId,
    );

    return await this.commentService.getComments(memberId, input);
  }

  // ADMIN
  @Roles(MemberType.ADMIN)
  @UseGuards(RolesGuard)
  @Mutation(() => Comment)
  public async removeCommentByAdmin(
    @Args("commentId") input: string,
  ): Promise<Comment> {
    console.log("Mutation: removeCommentByAdmin");

    const commentId = shapeIntoMongoObjectId(input);

    return await this.commentService.removeCommentByAdmin(commentId);
  }
}
