import { isAbsolute, join } from "path";
export function apiPort(batch = false): number {
  const value =
    process.env.PORT ||
    (batch ? process.env.PORT_BATCH : process.env.PORT_API) ||
    (batch ? "3001" : "3000");
  const port = Number(value);
  if (
    !/^\d+$/.test(value) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  )
    throw new Error("Invalid service port");
  return port;
}
export function mongoUri(): string {
  const uri =
    process.env.NODE_ENV === "production"
      ? process.env.MONGO_PROD
      : process.env.MONGO_DEV;
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri))
    throw new Error("Configure the MongoDB URI for the selected environment");
  return uri;
}
export function uploadsDirectory(): string {
  const configured = process.env.UPLOAD_DIR;
  if (
    process.env.NODE_ENV === "production" &&
    (!configured || !isAbsolute(configured))
  )
    throw new Error(
      "Production requires an absolute UPLOAD_DIR on persistent storage",
    );
  return configured || join(process.cwd(), "uploads");
}
export function assertProductionEnvironment(): void {
  if (process.env.NODE_ENV !== "production") return;
  const secret = process.env.SECRET_TOKEN || "";
  if (secret.length < 32 || /replace|example|changeme/i.test(secret))
    throw new Error(
      "A strong SECRET_TOKEN of at least 32 characters is required",
    );
  mongoUri();
}
