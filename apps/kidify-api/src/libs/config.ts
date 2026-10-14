import { BadRequestException } from '@nestjs/common';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { T } from './types/common';

// =========================================================
// SORT CONFIGURATION
// =========================================================

export const availableSellerSorts = [
	'createdAt',
	'updatedAt',
	'memberLikes',
	'memberViews',
	'memberRank',
	'memberProducts',
	'memberSales',
	'averageRating',
];

export const availableMemberSorts = ['createdAt', 'updatedAt', 'memberLikes', 'memberViews'];

export const availableBoardArticleSorts = ['createdAt', 'updatedAt', 'articleLikes', 'articleViews'];

export const availableCommentSorts = ['createdAt', 'updatedAt'];
// =========================================================
// IMAGE CONFIGURATION
// =========================================================

export const validMimeTypes = ['image/png', 'image/jpg', 'image/jpeg'];

export const getSerialForImage = (filename: string): string => {
	const ext = path.parse(filename).ext;

	return randomUUID() + ext;
};

// =========================================================
// OBJECT ID
// =========================================================

export const shapeIntoMongoObjectId = (target: string | mongoose.Types.ObjectId): mongoose.Types.ObjectId => {
	if (target instanceof mongoose.Types.ObjectId) {
		return target;
	}

	if (!mongoose.isObjectIdOrHexString(target)) throw new BadRequestException('INVALID_ID');
	return new mongoose.Types.ObjectId(target);
};

// =========================================================
// LOOKUP MEMBER
// =========================================================
//login bolgan user biror narsaga like bosganmi yoqmi tekshirish mantigi
//memberId login bolgan userni idsi
//$lookup — MongoDB'da boshqa collectiondan ma'lumot olib kelish uchun ishlatiladi.
//from -> Qaysi collectionga borib qidiramiz?
//let ichida vaqtinchalik o‘zgaruvchilar yaratamiz. Ya'ni aggregation ichida ishlatish uchun qiymatlarni nomlab olamiz.
export const lookupAuthMemberLiked = (memberId: T, targetRefId: string = '$_id') => {
	return {
		$lookup: {
			from: 'likes',
			let: {
				localLikeRefId: targetRefId,
				localMemberId: memberId,
				localMyFavorite: true,
			},
			//pipeline: Mana shu yerda:likes collectionidan qaysi ma'lumotlarni olish kerakligini yozamiz
			pipeline: [
				{
					//$match — filter.Ya'ni:Faqat menga kerakli like'ni top.
					$match: {
						$expr: {
							// $expr MongoDB'ga:Bu yerda fieldlarni boshqa qiymatlar bilan solishtiraman degan imkoniyat beradi.
							$and: [{ $eq: ['$likeRefId', '$$localLikeRefId'] }, { $eq: ['$memberId', '$$localMemberId'] }],
							// likes.likeRefId == current target's _id
							//likes.memberId = login bo‘lgan memberId deganidir.
							// $and: Ikkala shart ham true bo‘lishi kerak.
							// Ikkalasi ham YES bo‘lsa:Bu user shu mahsulotni like qilgan
						},
					},
				},
				{
					$project: {
						//$project:Natijada qaysi fieldlarni ko‘rsatish kerak? deganidir.
						_id: 0, //_id ni natijaga chiqarma.
						memberId: 1, //chiqar
						likeRefId: 1, //+
						myFavorite: '$$localMyFavorite',
					},
				},
			],
			as: 'meLiked', //topilgan nasijanimeLiked nomi bn saqla
		},
	};
};

interface LookupAuthMemberFollowed {
	followerId: T;
	followingId: string;
}
//Bir member boshqa memberni follow qilganmi?
export const lookupAuthMemberFollowed =
	(input: LookupAuthMemberFollowed) =>
	//followerId, followingId
	(memberId: T, targetRefId: string = '$_id') => {
		//Bu esa birinchi function qaytarayotgan ikkinchi function.
		const { followerId, followingId } = input;
		return {
			$lookup: {
				from: 'follows', //collectionga boramiz
				let: {
					localFollowerId: followerId,
					localFollowingId: followingId,
					localMyFavorite: true,
				},
				pipeline: [
					{
						$match: {
							//Menga kerakli follow recordni top.
							$expr: {
								//Collection fieldlarini let variablelari bilan solishtiraman.
								$and: [{ $eq: ['$followerId', '$$localFollowerId'] }, { $eq: ['$followingId', '$$localFollowingId'] }],
							},
						},
					},
					{
						$project: {
							_id: 0,
							followerId: 1,
							followingId: 1,
							myFollowing: '$$localMyFavorite',
						},
					},
				],
				as: 'meFollowed',
			},
		};
	};

export const lookupMember = {
	$lookup: {
		from: 'members',
		localField: 'memberId',
		foreignField: '_id',
		as: 'memberData',
	},
};
export const lookupFollowingData = {
	$lookup: {
		from: 'members',
		localField: 'followingId',
		foreignField: '_id',
		as: 'followingData',
	},
};

export const lookupFollowerData = {
	$lookup: {
		from: 'members',
		localField: 'followerId',
		foreignField: '_id',
		as: 'followerData',
	},
};
