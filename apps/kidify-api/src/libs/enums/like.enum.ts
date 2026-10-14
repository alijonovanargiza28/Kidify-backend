import { registerEnumType } from "@nestjs/graphql";

export enum LikeGroup {
  MEMBER = "MEMBER",
  PRODUCT = "PRODUCT",
  ARTICLE = "ARTICLE",
  REVIEW = "REVIEW",
  COMMENT = "COMMENT",
}
registerEnumType(LikeGroup, {
  name: "LikeGroup",
});
