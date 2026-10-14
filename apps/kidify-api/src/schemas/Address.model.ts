import { Schema } from 'mongoose';
const AddressSchema = new Schema(
	{
		memberId: { type: Schema.Types.ObjectId, required: true },
		recipientName: String,
		phone: String,
		region: String,
		city: String,
		district: String,
		street: String,
		postalCode: String,
		instructions: String,
		isDefault: { type: Boolean, default: false },
	},
	{ timestamps: true, collection: 'addresses' },
);
AddressSchema.index({ memberId: 1 });
AddressSchema.index({ memberId: 1, isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });
export default AddressSchema;
