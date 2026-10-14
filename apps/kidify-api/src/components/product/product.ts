import { Field, Float, Int, ObjectType, InputType } from "@nestjs/graphql";
import {
  IsOptional,
  IsDate,
  IsEnum,
  IsString,
  IsNotEmpty,
  IsInt,
  IsNumber,
  Min,
  Max,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsMongoId,
} from "class-validator";
import { Type } from "class-transformer";
import { TotalCounter } from "../../libs/dto/member/member";
import {
  ProductType,
  ProductCategory,
  ProductCollection,
  ProductStatus,
  ProductSort,
} from "../../libs/enums/product.enum";
import { PageInquiry } from "../../libs/marketplace";
import { MeLiked } from "../../libs/dto/like/like";
@InputType()
export class ProductVariantInput {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  @Field(() => Int, { nullable: true })
  ageMinMonths?: number;
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  @Field(() => Int, { nullable: true })
  ageMaxMonths?: number;
  @IsOptional()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @Field(() => [String], { nullable: true })
  images?: string[];
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Field(() => String, { nullable: true })
  color?: string;
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Field(() => String, { nullable: true })
  size?: string;
  @IsInt() @Min(0) @Field(() => Int) stock!: number;
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Field(() => String, { nullable: true })
  sku?: string;
}
@ObjectType()
export class ProductVariant {
  @Field(() => Int, { nullable: true }) ageMinMonths?: number;
  @Field(() => Int, { nullable: true }) ageMaxMonths?: number;
  @Field(() => [String], { nullable: true }) images?: string[];
  @Field(() => String) _id!: string;
  @Field(() => String, { nullable: true }) color?: string;
  @Field(() => String, { nullable: true }) size?: string;
  @Field(() => Int) stock!: number;
  @Field(() => String, { nullable: true }) sku?: string;
}
@InputType()
export class ProductInput {
  @IsOptional()
  @IsDate()
  @Field(() => Date, { nullable: true })
  saleStart?: Date;
  @IsOptional() @IsDate() @Field(() => Date, { nullable: true }) saleEnd?: Date;
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  @Field(() => String, { nullable: true })
  productInstructions?: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @Field(() => String)
  productName!: string;
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  @Field(() => String, { nullable: true })
  productDesc?: string;
  @IsNumber() @Min(0) @Field(() => Float) productPrice!: number;
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Field(() => [String])
  productImages!: string[];
  @IsEnum(ProductType) @Field(() => ProductType) productType!: ProductType;
  @IsEnum(ProductCategory)
  @Field(() => ProductCategory)
  productCategory!: ProductCategory;
  @IsOptional()
  @Field(() => ProductCollection, { nullable: true })
  productCollection?: ProductCollection;
  @IsOptional()
  @IsMongoId()
  @Field(() => String, { nullable: true })
  productBrandId?: string;
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Field(() => Int, { nullable: true })
  productDiscount?: number;
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  material?: string;
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  careInstructions?: string;
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  deliveryReturnInfo?: string;
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProductVariantInput)
  @Field(() => [ProductVariantInput])
  productVariants!: ProductVariantInput[];
}
@ObjectType()
export class Product {
  @Field(() => Date, { nullable: true }) saleStart?: Date;
  @Field(() => Date, { nullable: true }) saleEnd?: Date;
  @Field(() => String, { nullable: true }) productInstructions?: string;
  @Field(() => String) _id!: string;
  @Field(() => String) productName!: string;
  @Field(() => String, { nullable: true }) productDesc?: string;
  @Field(() => Float) productPrice!: number;
  @Field(() => [String]) productImages!: string[];
  @IsEnum(ProductType) @Field(() => ProductType) productType!: ProductType;
  @IsEnum(ProductCategory)
  @Field(() => ProductCategory)
  productCategory!: ProductCategory;
  @Field(() => ProductCollection, { nullable: true })
  productCollection?: ProductCollection;
  @Field(() => String, { nullable: true }) productBrandId?: string;
  @Field(() => Int, { nullable: true }) productDiscount?: number;
  @Field(() => String, { nullable: true }) material?: string;
  @Field(() => String, { nullable: true }) careInstructions?: string;
  @Field(() => String, { nullable: true }) deliveryReturnInfo?: string;
  @Field(() => String) productSellerId!: string;
  @Field(() => ProductStatus) productStatus!: ProductStatus;
  @Field(() => [ProductVariant]) productVariants!: ProductVariant[];
  @Field(() => Int) productViews!: number;
  @Field(() => Int) productFavorites!: number;
  @Field(() => Int) productComments!: number;
  @Field(() => Int) productReviews!: number;
  @Field(() => Int) productSales!: number;
  @Field(() => Float) averageRating!: number;
  @Field(() => Float) productRank!: number;
  @Field(() => Float) finalPrice!: number;
  @Field(() => Float, { nullable: true }) productOldPrice?: number;
  @Field(() => [String]) badges!: string[];
  @Field(() => [MeLiked], { nullable: true }) meLiked?: MeLiked[];
  @Field(() => Date) createdAt!: Date;
  @Field(() => Date) updatedAt!: Date;
}
@ObjectType()
export class Products {
  @Field(() => [Product]) list!: Product[];
  @Field(() => [TotalCounter]) metaCounter!: TotalCounter[];
}
@InputType()
export class ProductSearch {
 @IsOptional() @IsInt() @Min(0) @Max(240) @Field(() => Int,{nullable:true}) ageFromMonths?:number;
 @IsOptional() @IsInt() @Min(0) @Max(240) @Field(() => Int,{nullable:true}) ageToMonths?:number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  @Field(() => Int, { nullable: true })
  ageMonth?: number;
  @IsOptional() @Field(() => Boolean, { nullable: true }) saleOnly?: boolean;
  @IsOptional()
  @Field(() => ProductCategory, { nullable: true })
  category?: ProductCategory;
  @IsOptional()
  @Field(() => ProductType, { nullable: true })
  type?: ProductType;
  @IsOptional()
  @Field(() => ProductCollection, { nullable: true })
  collection?: ProductCollection;
  @IsOptional() @Field(() => String, { nullable: true }) brandId?: string;
  @IsOptional() @Field(() => String, { nullable: true }) sellerId?: string;
  @IsOptional() @Field(() => String, { nullable: true }) color?: string;
  @IsOptional() @Field(() => String, { nullable: true }) size?: string;
  @IsOptional() @Field(() => Float, { nullable: true }) minPrice?: number;
  @IsOptional() @Field(() => Float, { nullable: true }) maxPrice?: number;
  @IsOptional() @Field(() => Int, { nullable: true }) discount?: number;
  @IsOptional()
  @Field(() => ProductStatus, { nullable: true })
  status?: ProductStatus;
  @IsOptional() @Field(() => String, { nullable: true }) text?: string;
}

@InputType()
export class ProductsInquiry extends PageInquiry {
  @IsOptional()
  @Field(() => ProductSort, { defaultValue: ProductSort.NEWEST })
  sort: ProductSort = ProductSort.NEWEST;
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductSearch)
  @Field(() => ProductSearch, { nullable: true })
  search?: ProductSearch;
}
@InputType()
export class ProductUpdate extends ProductInput {
  @IsMongoId() @Field(() => String) _id!: string;
}
