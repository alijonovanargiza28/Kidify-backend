// Local AI runtime helper. Keep the inference API on loopback.
const { existsSync, mkdirSync, readFileSync } = require("fs");
const { join } = require("path");
const { spawn } = require("child_process");
const root = join(__dirname, "..");
const envPath = join(root, ".env");
const config = existsSync(envPath)
  ? require("dotenv").parse(readFileSync(envPath))
  : {};
const bundled = join(root, ".local", "ollama", "ollama");
const executable = existsSync(bundled) ? bundled : "ollama";
const action = process.argv[2];
if (!["serve", "pull"].includes(action))
  throw new Error("Use npm run ai:serve or npm run ai:pull");
const runtimeEnv = { ...process.env, OLLAMA_HOST: "127.0.0.1:11434" };
if (existsSync(bundled)) {
  runtimeEnv.OLLAMA_MODELS = join(root, ".local", "models");
  mkdirSync(runtimeEnv.OLLAMA_MODELS, { recursive: true });
}
const child = spawn(
  executable,
  action === "serve"
    ? ["serve"]
    : ["pull", config.OLLAMA_CHAT_MODEL || "qwen2.5:3b"],
  { stdio: "inherit", env: runtimeEnv },
);
child.on("error", () => {
  console.error("Install Ollama first: https://ollama.com/download");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
