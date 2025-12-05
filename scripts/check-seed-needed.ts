import { prisma } from '../packages/database/src/index';

/**
 * Check if the database has sufficient historical data
 * Returns true if seeding is needed
 */
async function checkNeedsSeed(): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "Trade"
    `;
    
    const tradeCount = Number(result[0].count);
    
    // If less than 1000 trades total, we need to seed
    if (tradeCount < 1000) {
      console.log(`\n Database has only ${tradeCount} trades. Seeding recommended.\n`);
      return true;
    }
    
    console.log(`Database has ${tradeCount} trades. Seeding not needed.\n`);
    return false;
  } catch (error) {
    console.error('Error checking database:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

checkNeedsSeed()
  .then((needsSeed) => {
    process.exit(needsSeed ? 1 : 0);
  })
  .catch(() => {
    process.exit(0);
  });
