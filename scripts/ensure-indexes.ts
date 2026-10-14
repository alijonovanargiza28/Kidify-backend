/** Review-only by default. Never drops indexes, edits records or deletes collections. */
import "reflect-metadata";
import { readdirSync } from "fs";
import { join } from "path";
import mongoose, { Schema } from "mongoose";
import { ConfigModule } from "@nestjs/config";
import { mongoUri } from "../apps/kidify-api/src/libs/runtime";
ConfigModule.forRoot();
async function main() {
  const apply = process.argv.includes("--apply");
  const connection = await mongoose
    .createConnection(mongoUri(), {
      autoIndex: false,
      autoCreate: false,
      serverSelectionTimeoutMS: 10000,
    })
    .asPromise();
  try {
    const schemas = join(__dirname, "../apps/kidify-api/src/schemas");
    const entries: Array<[string, Schema]> = readdirSync(schemas)
      .filter((name) => name.endsWith(".model.ts"))
      .map((file) => [
        file.replace(".model.ts", ""),
        require(join(schemas, file)).default,
      ]);
    entries.push([
      "RefreshSession",
      require("../apps/kidify-api/src/components/auth/refresh-session.model")
        .default,
    ]);
    for (const [name, schema] of entries) {
      if (!(schema instanceof Schema))
        throw new Error("Unexpected schema export");
      const model = connection.model(name, schema);
      const existing = await model.collection
        .listIndexes()
        .toArray()
        .catch((error) => {
          if (error.code === 26) return [];
          throw error;
        });
      console.log(
        JSON.stringify({
          collection: model.collection.collectionName,
          declared: schema.indexes().length,
          existing: existing.length,
          apply,
        }),
      );
      if (apply) await model.createIndexes();
    }
    console.log(
      apply
        ? "Declared indexes created; no indexes dropped or data edited."
        : "Review only. Back up and review duplicates before explicitly using --apply.",
    );
  } finally {
    await connection.close();
  }
}
main().catch(() => {
  console.error(
    "Index verification failed. Check access, duplicate data and index options. No records were deleted.",
  );
  process.exitCode = 1;
});
