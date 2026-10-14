import { Schema } from "mongoose";
const CartSchema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, required: true, unique: true },
    items: [
      new Schema({
        productId: { type: Schema.Types.ObjectId, required: true },
        variantId: { type: Schema.Types.ObjectId, required: true },
        ageMonth: Number,
        color: String,
        size: String,
        quantity: { type: Number, required: true, min: 1, max: 1000 },
      }),
    ],
  },
  { timestamps: true, collection: "carts" },
);
export default CartSchema;
