import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config()

import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import bcrypt from "bcryptjs"

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const DEFAULT_PASSWORD = "ChangeMe123!"
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)

  const users = await prisma.user.findMany({
    select: { id: true, email: true, passwordHash: true }
  })

  console.log(`Found ${users.length} total users in database.`)

  for (const user of users) {
    if (!user.passwordHash) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash }
      })
      console.log(`✓ Set default password ("${DEFAULT_PASSWORD}") for user ${user.email}`)
    } else {
      console.log(`- User ${user.email} already has a password set. Skipping.`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
