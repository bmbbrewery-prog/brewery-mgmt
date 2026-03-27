import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const deleted = await prisma.batch.deleteMany({
    where: {
      OR: [
        { name: { contains: 'Isolation' } },
        { name: { contains: 'Test' } }
      ]
    }
  })
  console.log(`Deleted ${deleted.count} test batches`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
