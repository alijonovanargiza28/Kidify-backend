import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import mongoose from 'mongoose';

export const AuthMember = createParamDecorator((data: string, context: ExecutionContext | any) => {
	let request: any;

	if (context.getType() === 'graphql') {
		request = context.getArgByIndex(2).req;

		if (request.body.authMember) {
			request.body.authMember.authorization = request.headers?.authorization;
		}
	} else {
		request = context.switchToHttp().getRequest();
	}

	const member = request.body.authMember;

	if (!member) {
		return null;
	}

	const value = data ? member?.[data] : member;

	// _id ni mongoose.Types.ObjectId qilib qaytaramiz
	if (data === '_id' && value) {
		return new mongoose.Types.ObjectId(value.toString());
	}

	return value;
});
