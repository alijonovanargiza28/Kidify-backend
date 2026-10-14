import 'reflect-metadata';
import { ConfigModule } from '@nestjs/config';
import { connect, connection, model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import MemberSchema from '../apps/kidify-api/src/schemas/Member.model';
ConfigModule.forRoot();
async function main() {
	const { ADMIN_NICK: memberNick, ADMIN_PHONE: memberPhone, ADMIN_PASSWORD: password } = process.env;
	if (!memberNick || !memberPhone || !password || password.length < 8)
		throw new Error('Set ADMIN_NICK, ADMIN_PHONE and ADMIN_PASSWORD (8+ characters)');
	if (!process.argv.includes('--apply')) {
		console.log(
			'Dry run: would create one ADMIN using a hashed password. No database connection made. Pass --apply to create.',
		);
		return;
	}
	const uri = process.env.NODE_ENV === 'production' ? process.env.MONGO_PROD : process.env.MONGO_DEV;
	if (!uri) throw new Error('MongoDB URI is required');
	await connect(uri);
	try {
		const Member = model('Member', MemberSchema);
		const memberPassword = await bcrypt.hash(password, await bcrypt.genSalt());
		await Member.create({ memberNick, memberPhone, memberPassword, memberType: 'ADMIN', memberStatus: 'ACTIVE' });
		console.log('ADMIN created. Credentials are not printed.');
	} finally {
		await connection.close();
	}
}
main().catch((error) => {
	console.error(error.code === 11000 ? 'Nickname or phone already exists' : (error.name ?? 'Admin creation failed'));
	process.exitCode = 1;
});
