import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config() // Fallback to .env
import path from "node:path"
import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!,
  },
})
