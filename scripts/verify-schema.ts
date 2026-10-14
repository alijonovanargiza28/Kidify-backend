import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'fs';
import { printSchema, validateSchema } from 'graphql';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { createOfflineApp } from '../apps/kidify-api/src/testing/offline-app';
async function main() {
	const app = await createOfflineApp();
	try {
		const schema = app.get(GraphQLSchemaHost).schema;
		const errors = validateSchema(schema);
		if (errors.length) throw errors[0];
		mkdirSync('docs', { recursive: true });
		writeFileSync('docs/graphql-schema.graphql', printSchema(schema) + '\n');
		const queries = Object.keys(schema.getQueryType()!.getFields());
		const mutations = Object.keys(schema.getMutationType()!.getFields());
		writeFileSync(
			'docs/graphql-operations.md',
			'# Kidify GraphQL operations\n\nSee `graphql-schema.graphql` for exact input, output and enum definitions.\n\n## Queries\n\n' +
				queries.map((name) => '- `' + name + '`').join('\n') +
				'\n\n## Mutations\n\n' +
				mutations.map((name) => '- `' + name + '`').join('\n') +
				'\n',
		);
		const connection = app.get<Connection>(getConnectionToken());
		const indexes = Object.fromEntries(
			Object.entries(connection.models).map(([name, model]) => [name, model.schema.indexes()]),
		);
		writeFileSync('docs/database-indexes.json', JSON.stringify(indexes, null, 2) + '\n');
		console.log(
			`Schema valid: ${Object.keys(schema.getQueryType()!.getFields()).length} queries, ${Object.keys(schema.getMutationType()!.getFields()).length} mutations.`,
		);
	} finally {
		await app.get<Connection>(getConnectionToken()).destroy();
		await app.close();
	}
}
main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
