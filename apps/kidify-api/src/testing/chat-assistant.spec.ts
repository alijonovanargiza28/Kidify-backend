import { ChatAssistantService } from "../components/message/chat-assistant.service";
import { validateAssistantSearch } from "../components/product/assistant-search";
import { ProductService } from "../components/product/product.service";
import { Types } from "mongoose";
import { Logger } from "@nestjs/common";
const actor = { _id: new Types.ObjectId("000000000000000000000001") } as any;
const product = {
  _id: "000000000000000000000002",
  productName: "Catalog fixture",
  finalPrice: 20,
  available: true,
  productImages: ["/uploads/existing.png"],
};
describe("AI catalog tool boundary", () => {
  let service: ChatAssistantService, products: any, orders: any, quotas: any;
  const originalFetch = global.fetch,
    originalKey = process.env.OPENAI_API_KEY,
    originalModel = process.env.OPENAI_CHAT_MODEL,
    originalProvider = process.env.CHAT_AI_PROVIDER,
    originalOllamaModel = process.env.OLLAMA_CHAT_MODEL;
  beforeEach(() => {
    products = { searchForAssistant: jest.fn().mockResolvedValue([product]) };
    orders = {
      find: jest.fn().mockReturnValue({
        select: () => ({
          sort: () => ({ limit: () => ({ lean: async () => [] }) }),
        }),
      }),
    };
    quotas = { quota: jest.fn().mockResolvedValue(undefined) };
    service = new ChatAssistantService(products, orders, quotas);
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    process.env.OPENAI_API_KEY = "test-not-a-real-key";
    process.env.OPENAI_CHAT_MODEL = "test-model";
    process.env.CHAT_AI_PROVIDER = "openai";
  });
  afterEach(() => {
    if (originalProvider === undefined) delete process.env.CHAT_AI_PROVIDER;
    else process.env.CHAT_AI_PROVIDER = originalProvider;
    if (originalOllamaModel === undefined) delete process.env.OLLAMA_CHAT_MODEL;
    else process.env.OLLAMA_CHAT_MODEL = originalOllamaModel;
    jest.restoreAllMocks();
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_CHAT_MODEL;
    else process.env.OPENAI_CHAT_MODEL = originalModel;
  });
  it.each([
    { text: { $ne: null } },
    { status: "DELETE" },
    { category: "INVENTED" },
    { ageMonth: -1 },
    { ageMonth: 6.5 },
    { minPrice: 30, maxPrice: 20 },
    { brand: { $regex: ".*" } },
  ])("rejects untrusted query/filter arguments %j", (value) => {
    expect(() => validateAssistantSearch(value)).toThrow("INVALID_SEARCH");
  });
  it("delegates combined filters to ProductService without Mongo operators", async () => {
    const filters = {
      category: "SET",
      ageMonth: 6,
      color: "Blue",
      brand: "H&M",
      minPrice: 10,
      maxPrice: 100,
    };
    expect(
      await service.executeTool(actor, "search_products", filters, "test"),
    ).toEqual({ products: [product] });
    expect(products.searchForAssistant).toHaveBeenCalledWith(filters);
  });
  it("scopes order lookup to authenticated owner and rejects supplied customer IDs", async () => {
    await service.executeTool(
      actor,
      "get_my_orders",
      { orderId: null },
      "test",
    );
    expect(orders.find).toHaveBeenCalledWith({ memberId: actor._id });
    await expect(
      service.executeTool(
        actor,
        "get_my_orders",
        { memberId: product._id },
        "test",
      ),
    ).rejects.toThrow("INVALID_SEARCH");
  });
  it("rejects arbitrary function names", async () => {
    await expect(
      service.executeTool(actor, "delete_products", {}, "test"),
    ).rejects.toThrow("INVALID_SEARCH");
  });
  it("logs database failure separately from zero results", async () => {
    products.searchForAssistant.mockResolvedValueOnce([]);
    expect(
      await service.executeTool(actor, "search_products", {}, "trace"),
    ).toEqual({ products: [] });
    expect(Logger.prototype.log).toHaveBeenCalledWith(
      expect.stringContaining("AI_SEARCH_ZERO"),
    );
    products.searchForAssistant.mockRejectedValueOnce(
      new Error("database offline"),
    );
    await expect(
      service.executeTool(actor, "search_products", {}, "trace"),
    ).rejects.toThrow("AI_SEARCH_FAILED");
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining("AI_MONGODB_SEARCH_ERROR"),
    );
  });
  it("identifies missing configuration before making any API calls", async () => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = jest.fn();
    await expect(
      service.answer(
        actor,
        { text: "Find products", locale: "en" },
        jest.fn(),
        new AbortController().signal,
      ),
    ).rejects.toThrow("AI_NOT_CONFIGURED");
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it("logs OpenAI status/code independently without leaking the key", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: "insufficient_quota" } }),
          { status: 429 },
        ),
      );
    await expect(
      service.answer(
        actor,
        { text: "Find products", locale: "en" },
        jest.fn(),
        new AbortController().signal,
      ),
    ).rejects.toThrow("AI_PROVIDER_LIMIT");
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining("AI_OPENAI_API_ERROR"),
    );
    expect(
      JSON.stringify((Logger.prototype.error as jest.Mock).mock.calls),
    ).not.toContain("test-not-a-real-key");
  });
  it.each(["en", "ko", "uz"])(
    "executes a tool and streams grounded results in %s",
    async (locale) => {
      const args = {
        text: null,
        type: "CLOTHING",
        category: "SET",
        collection: null,
        ageMonth: 6,
        size: null,
        color: "Blue",
        brand: null,
        minPrice: null,
        maxPrice: 100,
      };
      const plan = {
        status: "completed",
        output: [
          {
            type: "function_call",
            name: "search_products",
            call_id: "call_one",
            arguments: JSON.stringify(args),
          },
        ],
      };
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(plan)))
        .mockResolvedValueOnce(
          new Response(
            'data: {"type":"response.output_text.delta","delta":"Found"}\n\ndata: {"type":"response.completed"}\n\n',
          ),
        );
      const emit = jest.fn();
      await service.answer(
        actor,
        {
          text:
            locale === "ko"
              ? "6개월 파란색 세트"
              : locale === "uz"
                ? "6 oylik ko‘k to‘plam"
                : "Blue set for 6 months",
          locale,
        },
        emit,
        new AbortController().signal,
      );
      expect(emit).toHaveBeenCalledWith("aiProducts", [product]);
      expect(emit).toHaveBeenCalledWith("aiDelta", "Found");
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[1][1].body,
      );
      expect(body.instructions).toContain(`Reply in ${locale}`);
      expect(body.input.at(-1).type).toBe("function_call_output");
      expect(body.input.at(-1).output).toContain(product._id);
    },
  );
  it("zero results are explicit and do not invoke a second model call", async () => {
    products.searchForAssistant.mockResolvedValue([]);
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "function_call",
              name: "search_products",
              call_id: "one",
              arguments: "{}",
            },
          ],
        }),
      ),
    );
    const emit = jest.fn();
    await service.answer(
      actor,
      { text: "nothing matches", locale: "en" },
      emit,
      new AbortController().signal,
    );
    expect(emit).toHaveBeenCalledWith(
      "aiDelta",
      expect.stringContaining("No available products match"),
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  it("uses local Ollama with no API key and returns validated catalog cards", async () => {
    process.env.CHAT_AI_PROVIDER = "ollama";
    process.env.OLLAMA_CHAT_MODEL = "qwen2.5:3b";
    delete process.env.OPENAI_API_KEY;
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            done: true,
            message: {
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  function: {
                    name: "search_products",
                    arguments: { ageMonth: 24, category: "CLOTHING" },
                  },
                },
              ],
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            done: true,
            message: {
              content:
                "<think>Internal planning</think>Found matching products.",
            },
          }),
        ),
      );
    const emit = jest.fn();
    await service.answer(
      actor,
      { text: "2 yoshga kiyim", locale: "uz", action: "products" },
      emit,
      new AbortController().signal,
    );
    expect(products.searchForAssistant).toHaveBeenCalledWith({
      ageMonth: 24,
      type: "CLOTHING",
    });
    expect(emit).toHaveBeenCalledWith("aiProducts", [product]);
    expect(emit).toHaveBeenCalledWith("aiDelta", "Found matching products.");
    for (const [url, options] of (global.fetch as jest.Mock).mock.calls) {
      expect(url).toBe("http://127.0.0.1:11434/api/chat");
      expect(options.headers.Authorization).toBeUndefined();
    }
  });
  it("rejects a local model attempting an unoffered tool before accessing the database", async () => {
    process.env.CHAT_AI_PROVIDER = "ollama";
    process.env.OLLAMA_CHAT_MODEL = "qwen2.5:3b";
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          done: true,
          message: {
            tool_calls: [
              {
                function: {
                  name: "get_my_orders",
                  arguments: { orderId: null },
                },
              },
            ],
          },
        }),
      ),
    );
    await expect(
      service.answer(
        actor,
        { text: "products", locale: "en", action: "products" },
        jest.fn(),
        new AbortController().signal,
      ),
    ).rejects.toThrow("AI_PROVIDER_ERROR");
    expect(orders.find).not.toHaveBeenCalled();
  });
  it("fails clearly when Ollama is offline instead of falling back to a paid provider", async () => {
    process.env.CHAT_AI_PROVIDER = "ollama";
    process.env.OLLAMA_CHAT_MODEL = "qwen2.5:3b";
    global.fetch = jest.fn().mockRejectedValue(new TypeError("offline"));
    await expect(
      service.answer(
        actor,
        { text: "hello", locale: "en" },
        jest.fn(),
        new AbortController().signal,
      ),
    ).rejects.toThrow("AI_PROVIDER_ERROR");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
describe("ProductService assistant catalog visibility", () => {
  it("adds stock to the same variant and preserves public seller/price filters", async () => {
    const model = {
      aggregate: jest.fn().mockResolvedValue([{ list: [], metaCounter: [] }]),
    };
    const service = new ProductService(
      null as any,
      null as any,
      model as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
    );
    await service.searchForAssistant({
      color: "Blue",
      ageMonth: 6,
      maxPrice: 100,
    });
    const pipeline = model.aggregate.mock.calls[0][0] as any[];
    const match = pipeline.find((stage) => stage.$match).$match;
    expect(match.productStatus).toBe("ACTIVE");
    expect(match.deletedAt).toBeNull();
    expect(match.adminPaused).toEqual({ $ne: true });
    expect(match.productVariants.$elemMatch.stock).toEqual({ $gt: 0 });
    expect(match.productVariants.$elemMatch.color.$regex).toBe("^Blue$");
    expect(match.$expr).toBeDefined();
    expect(
      pipeline.some(
        (stage) => stage.$match?.["seller.memberStatus"] === "ACTIVE",
      ),
    ).toBe(true);
  });
});
