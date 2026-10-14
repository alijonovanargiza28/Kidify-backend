import 'reflect-metadata';
import { ConfigModule } from '@nestjs/config';
import { connect, connection } from 'mongoose';
ConfigModule.forRoot();
async function main() {
	const uri = process.env.NODE_ENV === 'production' ? process.env.MONGO_PROD : process.env.MONGO_DEV;
	if (!uri) throw new Error('MongoDB URI is required');
	await connect(uri);
	try {
		const members = connection.collection('members');
		const legacyCount = await members.countDocuments({ memberType: 'AGENT' });
		const articleCount = await connection
			.collection('boardArticles')
			.countDocuments({ articleCategory: { $in: ['RECOMMEND', 'HUMOR'] } });
		console.log(`Legacy AGENT accounts: ${legacyCount}; legacy article categories: ${articleCount}`);
		if (!process.argv.includes('--apply')) {
			console.log('Dry run only. Pass --apply after reviewing a database backup. Existing documents are retained.');
			return;
		}
		await members.updateMany({ memberType: 'AGENT' }, { $set: { memberType: 'SELLER' } });
		await members.updateMany({}, [
			{
				$set: {
					memberProducts: { $ifNull: ['$memberProducts', 0] },
					memberSales: { $ifNull: ['$memberSales', 0] },
					memberReviews: { $ifNull: ['$memberReviews', 0] },
					averageRating: { $ifNull: ['$averageRating', 0] },
				},
			},
		]);
		await connection
			.collection('boardArticles')
			.updateMany({ articleCategory: 'RECOMMEND' }, { $set: { articleCategory: 'PRODUCT_GUIDE' } });
		await connection
			.collection('boardArticles')
			.updateMany({ articleCategory: 'HUMOR' }, { $set: { articleCategory: 'FREE' } });
		console.log('Migration applied. Existing documents, likes, views and historical references retained.');
	} finally {
		await connection.close();
	}
}
main().catch((error) => {
	console.error(error.name ?? 'Migration failed');
	process.exitCode = 1;
});
