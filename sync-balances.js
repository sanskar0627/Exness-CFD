import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { createClient } from 'redis';

const prisma = new PrismaClient();
const redis = createClient({ url: 'redis://localhost:6379' });

await redis.connect();

async function syncBalances() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        usdBalance: true,
      }
    });

    console.log('\n🔄 Syncing user balances from database to cache...\n');
    
    for (const user of users) {
      const balanceInCents = Number(user.usdBalance);
      const balanceInDollars = balanceInCents / 100;
      
      // Check current cache value
      const cacheKey = `balance:${user.id}`;
      const cachedValue = await redis.get(cacheKey);
      
      console.log(`User: ${user.email}`);
      console.log(`  DB Balance: $${balanceInDollars.toFixed(2)} (${balanceInCents} cents)`);
      console.log(`  Cache Balance: ${cachedValue ? `$${cachedValue}` : 'NOT SET'}`);
      
      // Clear cache to force refresh from database
      if (cachedValue) {
        await redis.del(cacheKey);
        console.log(`  ✅ Cleared cache - will refresh from DB on next request`);
      }
      
      console.log('');
    }

    console.log('✅ All balances synced!\n');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    await redis.quit();
  }
}

syncBalances();
