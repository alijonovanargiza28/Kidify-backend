import { Schema } from "mongoose";
import {
  ProductType,
  ProductCategory,
  ProductCollection,
  ProductStatus,
} from "../libs/enums/product.enum";
const variant = new Schema({
  color: String,
  images: { type: [String], default: undefined },
  ageMinMonths: { type: Number, min: 0, max: 240 },
  ageMaxMonths: { type: Number, min: 0, max: 240 },
  size: String,
  stock: { type: Number, required: true, min: 0, validate: Number.isInteger },
  sku: String,
});
const ProductSchema = new Schema(
  {
    productName: { type: String, required: true, maxlength: 150 },
    productDesc: String,
    productPrice: { type: Number, required: true, min: 0 },
    productImages: { type: [String], required: true },
    productType: { type: String, enum: ProductType, required: true },
    productCategory: { type: String, enum: ProductCategory, required: true },
    productCollection: { type: String, enum: ProductCollection },
    productBrandId: { type: Schema.Types.ObjectId, ref: "Brand" },
    productSellerId: {
      type: Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    productStatus: {
      type: String,
      enum: ProductStatus,
      default: ProductStatus.ACTIVE,
    },
    productVariants: { type: [variant], required: true },
    productDiscount: { type: Number, default: 0, min: 0, max: 100 },
    productViews: { type: Number, default: 0 },
    productFavorites: { type: Number, default: 0 },
    productComments: { type: Number, default: 0 },
    productReviews: { type: Number, default: 0 },
    productSales: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    productRank: { type: Number, default: 0 },
    adminPaused: { type: Boolean, default: false },
    material: String,
    saleStart: Date,
    saleEnd: Date,
    productInstructions: String,
    lowStockEvent: { type: Number, default: 0 },
    lowStockActive: { type: Boolean, default: false },
    careInstructions: String,
    deliveryReturnInfo: String,
    deletedAt: Date,
  },
  { timestamps: true, collection: "products" },
);
ProductSchema.index({ productStatus: 1, productCategory: 1, createdAt: -1 });
ProductSchema.index({ productSellerId: 1, productStatus: 1 });
ProductSchema.index({ productBrandId: 1, productStatus: 1 });
export default ProductSchema;
