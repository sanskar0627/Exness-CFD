import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAllUsers() {
  try {
    console.log('=== FIXING ALL USER BALANCES ===');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        usdBalance: true
      }
    });
    
    console.log(`Found ${users.length} users to check:`);
    
    for (const user of users) {
      const currentBalanceCents = Number(user.usdBalance);
      const currentBalanceDollars = currentBalanceCents / 100;
      
      console.log(`\nUser: ${user.email}`);
      console.log(`  Current balance: ${currentBalanceCents} cents ($${currentBalanceDollars})`);
      
      // If balance is not $5000, fix it
      if (currentBalanceCents !== 500000) {
        console.log(`  ❌ Incorrect balance! Fixing to $5000...`);
        
        await prisma.user.update({
          where: { id: user.id },
          data: { usdBalance: BigInt(500000) }
        });
        
        console.log(`  ✅ Fixed to $5000.00`);
      } else {
        console.log(`  ✅ Balance is correct ($5000.00)`);
      }
    }
    
    console.log('\n=== ALL USERS FIXED ===');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAllUsers();