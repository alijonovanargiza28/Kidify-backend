import { registerEnumType } from '@nestjs/graphql';

export enum ViewGroup {
	MEMBER = 'MEMBER',
	ARTICLE = 'ARTICLE',
	PROPERTY = 'PROPERTY',
	PRODUCT = 'PRODUCT',
	Member = 'Member',
}
registerEnumType(ViewGroup, {
	name: 'ViewGroup',
});
