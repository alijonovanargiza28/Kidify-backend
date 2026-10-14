import { registerEnumType } from "@nestjs/graphql";

export enum LikeGroup {
  MEMBER = "MEMBER",
  PROPERTY = "PROPERTY",
  PRODUCT = "PRODUCT",
  ARTICLE = "ARTICLE",
  REVIEW = "REVIEW",
  COMMENT = "COMMENT",
}
registerEnumType(LikeGroup, {
  name: "LikeGroup",
});
