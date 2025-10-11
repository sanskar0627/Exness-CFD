import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAllUsers() {
  try {
    console.log('=== ALL USERS IN DATABASE ===');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        usdBalance: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    users.forEach((user, index) => {
      console.log(`User ${index + 1}:`, {
        id: user.id.substring(0, 8) + '...',
        email: user.email,
        balance: Number(user.usdBalance) / 100,
        createdAt: user.createdAt.toISOString()
      });
    });
    
    console.log(`\nTotal users: ${users.length}`);
    
    // Check if there are users with wrong balances
    const wrongBalanceUsers = users.filter(user => Number(user.usdBalance) !== 500000);
    if (wrongBalanceUsers.length > 0) {
      console.log('\n=== USERS WITH INCORRECT BALANCE ===');
      wrongBalanceUsers.forEach(user => {
        console.log(`${user.email}: $${Number(user.usdBalance) / 100} (should be $5000.00)`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllUsers();