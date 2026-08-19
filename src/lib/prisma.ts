import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { Pool } from "@neondatabase/serverless"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  const adapter = connectionString
    ? new PrismaNeon(new Pool({ connectionString }) as any)
    : undefined
  return new PrismaClient(adapter ? { adapter } : ({} as any))
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
