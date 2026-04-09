import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'aditya@letsenterprise.in' }
  })
  console.log('User role:', user?.role)
  
  if (user && user.role !== 'ADMIN') {
    await prisma.user.update({
      where: { email: 'aditya@letsenterprise.in' },
      data: { role: 'ADMIN' }
    })
    console.log('Updated role to ADMIN')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
