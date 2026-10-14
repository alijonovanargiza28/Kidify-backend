import { BadRequestException } from "@nestjs/common";
import {
  ProductCategory,
  ProductCollection,
  ProductType,
} from "../../libs/enums/product.enum";
export type AssistantSearch = {
  text?: string;
  category?: ProductCategory;
  type?: ProductType;
  collection?: ProductCollection;
  ageMonth?: number;
  size?: string;
  color?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
};
const enums = {
  category: ProductCategory,
  type: ProductType,
  collection: ProductCollection,
};
const strings = ["text", "size", "color", "brand"];
const numbers = ["ageMonth", "minPrice", "maxPrice"];
export function validateAssistantSearch(value: unknown): AssistantSearch {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BadRequestException("INVALID_SEARCH");
  const result: any = {};
  for (const [key, item] of Object.entries(value)) {
    if (![...strings, ...numbers, ...Object.keys(enums)].includes(key))
      throw new BadRequestException("INVALID_SEARCH");
    if (item === null || item === undefined) continue;
    if (key in enums) {
      if (!Object.values(enums[key]).includes(item))
        throw new BadRequestException("INVALID_SEARCH");
      result[key] = item;
    } else if (strings.includes(key)) {
      if (typeof item !== "string" || item.length > 150)
        throw new BadRequestException("INVALID_SEARCH");
      if (item.trim()) result[key] = item.trim();
    } else {
      if (
        typeof item !== "number" ||
        !Number.isFinite(item) ||
        item < 0 ||
        item > (key === "ageMonth" ? 240 : 1000000000) ||
        (key === "ageMonth" && !Number.isInteger(item))
      )
        throw new BadRequestException("INVALID_SEARCH");
      result[key] = item;
    }
  }
  if (
    result.minPrice != null &&
    result.maxPrice != null &&
    result.minPrice > result.maxPrice
  )
    throw new BadRequestException("INVALID_SEARCH");
  return result;
}
const properties = {
  text: {
    type: ["string", "null"],
    description:
      "Specific product name or short English name keywords only. Translate generic Korean/Uzbek nouns into English. Do not include age, colors, brand, politeness or category words when separate filters express them. Null for broad recommendations.",
  },
  type: {
    type: ["string", "null"],
    enum: [...Object.values(ProductType), null],
  },
  category: {
    type: ["string", "null"],
    enum: [...Object.values(ProductCategory), null],
  },
  collection: {
    type: ["string", "null"],
    enum: [...Object.values(ProductCollection), null],
  },
  ageMonth: {
    type: ["integer", "null"],
    minimum: 0,
    maximum: 240,
    description:
      "Age in months; convert years to months. E.g. 6 oylik / 6개월 / 6 months -> 6.",
  },
  size: {
    type: ["string", "null"],
    description:
      "Exact requested size, e.g. S, M, 0-3M. Null if ageMonth expresses the request.",
  },
  color: {
    type: ["string", "null"],
    description:
      "English color e.g. Pink (pushti/분홍), Blue (ko‘k/파랑), White (oq/흰색), Beige, Brown, Yellow, Black, Gray.",
  },
  brand: {
    type: ["string", "null"],
    description: "Brand name as written, never invent an ID.",
  },
  minPrice: {
    type: ["number", "null"],
    minimum: 0,
    description:
      "Minimum price in the catalog currency. Never guess an exchange rate.",
  },
  maxPrice: {
    type: ["number", "null"],
    minimum: 0,
    description: "Maximum price in the catalog currency.",
  },
};
export const productSearchTool = {
  type: "function",
  name: "search_products",
  strict: true,
  description:
    "Read actual Kidify products by requested filters. Searches only active, in-stock products from active sellers, excluding deleted/paused listings. Understand English, Korean, Uzbek; normalize filters to the supported English enums. Use only requested constraints. Returns at most 6 real products. Empty list means no matches, never relax filters silently.",
  parameters: {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  },
};
