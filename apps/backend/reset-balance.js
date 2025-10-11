import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetUserBalance() {
  try {
    // Replace with your actual user ID or logic to select users
    const userId = '17f22892-3da9-4eb3-9d35-c514bb922285';
    const resetAmount = 5000.00; // $5,000.00
    const resetAmountCents = Math.round(resetAmount * 100);

    await prisma.user.update({
      where: { id: userId },
      data: { usdBalance: BigInt(resetAmountCents) }
    });

    console.log(`✅ User balance reset to $${resetAmount.toFixed(2)}`);
  } catch (error) {
    console.error('Error resetting balance:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetUserBalance();