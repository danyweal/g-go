// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

// Avoid multiple instances of Prisma Client in development (Next.js hot reload)
declare global {
  // eslint-disable-next-line no-var
  var _prisma: PrismaClient | undefined
}

const prisma =
  global._prisma ??
  new PrismaClient({
    log: ['warn', 'error'], // add 'query' if you need verbose logging
  })

if (process.env.NODE_ENV !== 'production') {
  global._prisma = prisma
}

export default prisma
