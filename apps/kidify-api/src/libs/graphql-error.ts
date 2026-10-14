import { Logger } from "@nestjs/common";
const logger = new Logger("GraphQL");
export function formatGraphqlError(error: any) {
  const originalCode = error?.extensions?.code || "INTERNAL_SERVER_ERROR";
  const message =
    error?.extensions?.exception?.response?.message ||
    error?.extensions?.response?.message ||
    error?.message;
  const internal = originalCode === "INTERNAL_SERVER_ERROR";
  // Keep existing business error codes; hide unexpected infrastructure exceptions in production.
  const safe =
    typeof message === "string" && /^[A-Z][A-Z0-9_]{2,100}$/.test(message);
  const publicMessage =
    process.env.NODE_ENV === "production" && internal && !safe
      ? "INTERNAL_SERVER_ERROR"
      : message;
  if (internal) logger.error("GraphQL operation failed");
  return {
    code: originalCode,
    message: publicMessage,
    path: error.path,
    extensions: {
      code: message === "UNAUTHORIZED" ? "UNAUTHENTICATED" : originalCode,
    },
  };
}
