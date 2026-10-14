/** Read-only audit: never creates documents, collections, indexes or fake catalog data. */
import "reflect-metadata";
import { config } from "dotenv";
import mongoose from "mongoose";
import ProductSchema from "../apps/nestar-api/src/schemas/Product.model";
import MemberSchema from "../apps/nestar-api/src/schemas/Member.model";
import BrandSchema from "../apps/nestar-api/src/schemas/Brand.model";
import { ProductService } from "../apps/nestar-api/src/components/product/product.service";
import { ChatAssistantService } from "../apps/nestar-api/src/components/message/chat-assistant.service";
import { AssistantSearch } from "../apps/nestar-api/src/components/product/assistant-search";
config();
async function run() {
  const uri =
    process.env.NODE_ENV === "production"
      ? process.env.MONGO_PROD
      : process.env.MONGO_DEV;
  if (!uri) throw new Error("MongoDB is not configured");
  const connection = await mongoose
    .createConnection(uri, {
      autoCreate: false,
      autoIndex: false,
      serverSelectionTimeoutMS: 10000,
    })
    .asPromise();
  try {
    const products = connection.model("Product", ProductSchema),
      members = connection.model("Member", MemberSchema),
      brands = connection.model("Brand", BrandSchema);
    const service = new ProductService(
      connection as any,
      null as any,
      products as any,
      members as any,
      brands as any,
      null as any,
      null as any,
      null as any,
    );
    const available = await service.searchForAssistant({});
    console.log(
      JSON.stringify({
        audit: "available_catalog",
        count: available.length,
        products: available.map((p) => ({
          id: p._id,
          name: p.productName,
          price: p.finalPrice,
          available: p.available,
          detailPath: p.detailPath,
        })),
      }),
    );
    let checks = 0;
    for (const card of available.slice(0, 3)) {
      const record = await products.findById(card._id).lean();
      if (!record) throw new Error("Product disappeared during audit");
      const variant = card.productVariants[0],
        brand = record.productBrandId
          ? await brands.findById(record.productBrandId).lean()
          : null;
      const filters: AssistantSearch = {
        text: card.productName,
        category: record.productCategory as any,
        type: record.productType as any,
        minPrice: card.finalPrice,
        maxPrice: card.finalPrice,
        ...(variant?.color ? { color: variant.color } : {}),
        ...(variant?.size ? { size: variant.size } : {}),
        ...(variant?.ageMinMonths != null
          ? { ageMonth: variant.ageMinMonths }
          : {}),
        ...(brand ? { brand: brand.brandName } : {}),
      };
      const found = await service.searchForAssistant(filters);
      if (!found.some((item) => item._id === card._id))
        throw new Error(`Combined filter failed for ${card._id}`);
      checks++;
      console.log(
        JSON.stringify({
          audit: "combined_filters",
          product: card.productName,
          filters,
          matched: found.map((p) => p._id),
        }),
      );
    }
    if (process.argv.includes("--ai")) {
      if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_CHAT_MODEL)
        throw new Error("OpenAI audit configuration missing");
      const actor = await members
        .findOne({ memberStatus: "ACTIVE" })
        .select("_id memberType")
        .lean();
      if (!actor)
        throw new Error("No existing active account for read-only audit");
      // Direct service audit: quotas are isolated in memory so the real database stays read-only.
      const assistant = new ChatAssistantService(
        service,
        null as any,
        { quota: async () => undefined } as any,
      );
      for (const [locale, text] of [
        ["en", "Find a blue toothbrush for a 6 month old under 60"],
        ["ko", "6개월 아기를 위한 파란색 칫솔을 60 이하로 찾아주세요"],
        ["uz", "6 oylik bola uchun 60 dan arzon ko‘k tish cho‘tkasi toping"],
      ]) {
        const found: any[] = [];
        let answer = "";
        const controller = new AbortController(),
          timeout = setTimeout(() => controller.abort(), 60000);
        try {
          await assistant.answer(
            actor as any,
            { locale, text, action: "products" },
            (event, data) => {
              if (event === "aiProducts") found.push(...data);
              if (event === "aiDelta") answer += data;
            },
            controller.signal,
          );
        } finally {
          clearTimeout(timeout);
        }
        console.log(
          JSON.stringify({
            audit: "live_ai",
            locale,
            products: found.map((p) => ({
              id: p._id,
              name: p.productName,
              price: p.finalPrice,
            })),
            answer,
          }),
        );
      }
    }
    const absent = await service.searchForAssistant({
      text: "Kidify-read-only-audit-no-such-product-572931",
    });
    if (absent.length) throw new Error("Unexpected zero-result audit match");
    console.log(
      JSON.stringify({
        audit: "PASS",
        combinedFilterChecks: checks,
        zeroResultCheck: true,
        databaseWrites: 0,
        openAIConfigured:
          !!process.env.OPENAI_API_KEY && !!process.env.OPENAI_CHAT_MODEL,
      }),
    );
  } finally {
    await connection.close();
  }
}
run().catch((error) => {
  console.error(
    JSON.stringify({
      audit: "FAILED",
      errorType: error.name,
      reason:
        /Combined filter|Product disappeared|Unexpected zero|AI_|OpenAI audit/.test(
          error.message,
        )
          ? error.message
          : "Check local database availability/configuration",
    }),
  );
  process.exitCode = 1;
});
