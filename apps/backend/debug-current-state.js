import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis();

async function debugCurrentState() {
  try {
    const userId = '17f22892-3da9-4eb3-9d35-c514bb922285';
    
    console.log('=== CURRENT USER STATE ===');
    
    // Check database balance
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    console.log('Database balance:', Number(user.usdBalance) / 100, 'USD');
    
    // Check Redis cache
    const cachedBalance = await redis.get(`user:${userId}:balance`);
    console.log('Redis cached balance:', cachedBalance ? Number(cachedBalance) / 100 : 'Not cached', 'USD');
    
    // Check open positions
    const openPositions = await prisma.order.findMany({
      where: {
        userId: userId,
        status: 'OPEN'
      }
    });
    
    console.log('\n=== OPEN POSITIONS ===');
    console.log('Number of open positions:', openPositions.length);
    
    let totalMarginUsed = 0;
    openPositions.forEach((position, index) => {
      const margin = Number(position.margin) / 100;
      totalMarginUsed += margin;
      console.log(`Position ${index + 1}:`, {
        symbol: position.symbol,
        type: position.type,
        margin: margin,
        openPrice: Number(position.openPrice) / 100000,
        leverage: position.leverage
      });
    });
    
    console.log('Total margin used:', totalMarginUsed, 'USD');
    console.log('Available balance should be:', (Number(user.usdBalance) / 100) - totalMarginUsed, 'USD');
    
    // Check recent closed positions
    const recentClosed = await prisma.order.findMany({
      where: {
        userId: userId,
        status: 'CLOSED'
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 5
    });
    
    console.log('\n=== RECENT CLOSED POSITIONS ===');
    recentClosed.forEach((position, index) => {
      console.log(`Closed ${index + 1}:`, {
        symbol: position.symbol,
        pnl: Number(position.pnl) / 100,
        closedAt: position.updatedAt
      });
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    await redis.disconnect();
  }
}

debugCurrentState();