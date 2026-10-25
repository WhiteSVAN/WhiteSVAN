import { existsSync } from "node:fs";

// Host-provided variables take precedence. Next.js loads its own env files.
for (const path of [".env.temporal", ".env"]) {
  if (existsSync(path)) process.loadEnvFile(path);
}
