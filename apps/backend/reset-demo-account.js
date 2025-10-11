import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDemoAccount() {
  try {
    const userId = '17f22892-3da9-4eb3-9d35-c514bb922285';
    const resetAmount = 5000.00; // $5,000.00
    const resetAmountCents = Math.round(resetAmount * 100);

    console.log('🔄 Resetting demo account...');
    
    // 1. Close all open positions
    const openPositions = await prisma.userOrder.updateMany({
      where: {
        userId: userId,
        status: 'open'
      },
      data: {
        status: 'closed',
        updatedAt: new Date()
      }
    });
    
    console.log(`✅ Closed ${openPositions.count} open positions`);
    
    // 2. Reset user balance
    await prisma.user.update({
      where: { id: userId },
      data: { 
        usdBalance: BigInt(resetAmountCents),
        updatedAt: new Date()
      }
    });
    
    console.log(`✅ Reset balance to $${resetAmount.toFixed(2)}`);
    
    // 3. Verify the reset
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    const remainingOpen = await prisma.userOrder.count({
      where: {
        userId: userId,
        status: 'open'
      }
    });
    
    console.log('\n=== VERIFICATION ===');
    console.log('Current balance:', Number(user.usdBalance) / 100, 'USD');
    console.log('Open positions:', remainingOpen);
    console.log('Available balance should be:', Number(user.usdBalance) / 100, 'USD');
    
  } catch (error) {
    console.error('❌ Error resetting account:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetDemoAccount();