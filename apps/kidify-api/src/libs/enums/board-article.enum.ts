import { registerEnumType } from '@nestjs/graphql';

export enum BoardArticleCategory {
	BABY_CARE = 'BABY_CARE',
	PARENTING = 'PARENTING',
	PRODUCT_GUIDE = 'PRODUCT_GUIDE',
	NEWS = 'NEWS',
	EVENTS = 'EVENTS',
	TIPS = 'TIPS',
	FREE = 'FREE',
}
registerEnumType(BoardArticleCategory, {
	name: 'BoardArticleCategory',
});

export enum BoardArticleStatus {
	ACTIVE = 'ACTIVE',
	DELETE = 'DELETE',
}
registerEnumType(BoardArticleStatus, {
	name: 'BoardArticleStatus',
});
