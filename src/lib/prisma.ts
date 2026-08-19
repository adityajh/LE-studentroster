import { PrismaClient } from "@prisma/client"
import { PrismaNeonHttp } from "@prisma/adapter-neon"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function cleanConnectionString(url: string): string {
  return url
    .replace("-pooler.", ".")
    .replace("&pgbouncer=true", "")
    .replace("?pgbouncer=true", "")
}

function createPrismaClient() {
  const rawUrl =
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_bmrZJ91UKvHO@ep-floral-forest-a48v8463.us-east-1.aws.neon.tech/neondb?sslmode=require"

  const connectionString = cleanConnectionString(rawUrl)
  const adapter = new PrismaNeonHttp(connectionString, {})
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
