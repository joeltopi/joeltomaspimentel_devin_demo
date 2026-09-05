import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv();

export default defineConfig({
  schema: path.join("platform", "db", "schema.prisma"),
  migrations: {
    path: path.join("platform", "db", "migrations"),
    seed: "tsx platform/db/seed.ts",
  },
});
