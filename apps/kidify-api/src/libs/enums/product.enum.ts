import { registerEnumType } from '@nestjs/graphql';
export enum ProductType {
	CLOTHING = 'CLOTHING',
	SHOES = 'SHOES',
	TOYS = 'TOYS',
	BABY_CARE = 'BABY_CARE',
	BOOKS = 'BOOKS',
	STROLLER = 'STROLLER',
	ACCESSORY = 'ACCESSORY',
	DEVELOPMENT_TOYS = 'DEVELOPMENT_TOYS',
	FEEDING = 'FEEDING',
	BATH = 'BATH',
	OTHER = 'OTHER',
}
registerEnumType(ProductType, { name: 'ProductType' });
export enum ProductCategory {
	SALE = 'SALE',
	TOP = 'TOP',
	BOTTOM = 'BOTTOM',
	DRESS = 'DRESS',
	OUTERWEAR = 'OUTERWEAR',
	SET = 'SET',
	SHOES = 'SHOES',
	DEVELOPMENT_TOYS = 'DEVELOPMENT_TOYS',
	PLUSH_TOYS = 'PLUSH_TOYS',
	BOOKS = 'BOOKS',
	CREAM = 'CREAM',
	LOTION = 'LOTION',
	SHAMPOO = 'SHAMPOO',
	BATH = 'BATH',
	STROLLER = 'STROLLER',
	CAR_SEAT = 'CAR_SEAT',
	BAG = 'BAG',
	HAT = 'HAT',
	SOCKS = 'SOCKS',
	BOTTLE = 'BOTTLE',
	PACIFIER = 'PACIFIER',
	TABLEWARE = 'TABLEWARE',
	OTHER = 'OTHER',
}
registerEnumType(ProductCategory, { name: 'ProductCategory' });
export enum ProductCollection {
	NEWBORN = 'NEWBORN',
	BABY = 'BABY',
	GIRLS = 'GIRLS',
	BOYS = 'BOYS',
	MOM = 'MOM',
	MONTHLY_PHOTO = 'MONTHLY_PHOTO',
	FIRST_BIRTHDAY = 'FIRST_BIRTHDAY',
	HOLIDAY = 'HOLIDAY',
}
registerEnumType(ProductCollection, { name: 'ProductCollection' });
export enum ProductStatus {
	ACTIVE = 'ACTIVE',
	PAUSE = 'PAUSE',
	SOLD_OUT = 'SOLD_OUT',
	DELETE = 'DELETE',
}
registerEnumType(ProductStatus, { name: 'ProductStatus' });
export enum ProductSort {
	NEWEST = 'NEWEST',
	PRICE_LOW_TO_HIGH = 'PRICE_LOW_TO_HIGH',
	PRICE_HIGH_TO_LOW = 'PRICE_HIGH_TO_LOW',
	MOST_VIEWED = 'MOST_VIEWED',
	MOST_FAVORITED = 'MOST_FAVORITED',
	BEST_SELLING = 'BEST_SELLING',
	TRENDING = 'TRENDING',
	DISCOUNT = 'DISCOUNT',
}
registerEnumType(ProductSort, { name: 'ProductSort' });
