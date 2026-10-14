import { Resolver, Query, Mutation, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { Types } from "mongoose";
import {
  Product,
  Products,
  ProductInput,
  ProductUpdate,
  ProductsInquiry,
} from "./product";
import { ProductService } from "./product.service";
import { ProductStatus } from "../../libs/enums/product.enum";
import { Member } from "../../libs/dto/member/member";
import { MemberType } from "../../libs/enums/member.enum";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WithoutGuard } from "../auth/guards/without.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthMember } from "../auth/decorators/authMember.decorator";
import { shapeIntoMongoObjectId } from "../../libs/config";
@Resolver()
export class ProductResolver {
  constructor(private readonly service: ProductService) {}
  @Roles(MemberType.SELLER)
  @UseGuards(RolesGuard)
  @Mutation(() => Product)
  createProduct(
    @Args("input") input: ProductInput,
    @AuthMember("_id") sellerId: Types.ObjectId,
  ) {
    return this.service.create(sellerId, input);
  }
  @Roles(MemberType.SELLER, MemberType.ADMIN)
  @UseGuards(RolesGuard)
  @Mutation(() => Product)
  updateProduct(
    @Args("input") input: ProductUpdate,
    @AuthMember() actor: Member,
  ) {
    return this.service.update(actor, input);
  }
  @Roles(MemberType.SELLER, MemberType.ADMIN)
  @UseGuards(RolesGuard)
  @Mutation(() => Product)
  changeProductStatus(
    @Args("productId") id: string,
    @Args("status", { type: () => ProductStatus }) status: ProductStatus,
    @AuthMember() actor: Member,
  ) {
    return this.service.status(actor, shapeIntoMongoObjectId(id), status);
  }
  @UseGuards(WithoutGuard)
  @Query(() => Products)
  getProducts(
    @Args("input") input: ProductsInquiry,
    @AuthMember("_id") memberId?: Types.ObjectId,
  ) {
    return this.service.list(input, memberId);
  }
  @Query(() => Products) getTodayRecommendations() {
    return this.service.today();
  }
  @UseGuards(WithoutGuard)
  @Query(() => Product)
  getProduct(
    @Args("productId") id: string,
    @AuthMember("_id") memberId?: Types.ObjectId,
  ) {
    return this.service.get(shapeIntoMongoObjectId(id), memberId);
  }
  @UseGuards(WithoutGuard)
  @Query(() => Products)
  async getRelatedProducts(
    @Args("productId") id: string,
    @Args("input") input: ProductsInquiry,
  ) {
    const product = await this.service.get(shapeIntoMongoObjectId(id));
    return this.service.list(
      {
        ...input,
        search: { ...input.search, category: product.productCategory },
      },
      undefined,
      false,
      shapeIntoMongoObjectId(id),
    );
  }
  @Roles(MemberType.ADMIN)
  @UseGuards(RolesGuard)
  @Query(() => Products)
  getAllProductsByAdmin(@Args("input") input: ProductsInquiry) {
    return this.service.list(input, undefined, true);
  }
  @Roles(MemberType.SELLER)
  @UseGuards(RolesGuard)
  @Query(() => Products)
  getMyProducts(
    @Args("input") input: ProductsInquiry,
    @AuthMember("_id") sellerId: Types.ObjectId,
  ) {
    return this.service.list(
      { ...input, search: { ...input.search, sellerId: String(sellerId) } },
      sellerId,
      true,
    );
  }
  @UseGuards(AuthGuard)
  @Mutation(() => Product)
  favoriteProduct(
    @Args("productId") id: string,
    @AuthMember("_id") memberId: Types.ObjectId,
  ) {
    return this.service.favorite(memberId, shapeIntoMongoObjectId(id));
  }
}
