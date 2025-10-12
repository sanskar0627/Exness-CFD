import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function checkBalance() {
  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        usdBalance: true,
      }
    });

    console.log('\n📊 User Balances:');
    console.log('═══════════════════════════════════════');
    
    users.forEach(user => {
      const balanceInCents = Number(user.usdBalance);
      const balanceInDollars = balanceInCents / 100;
      console.log(`\nUser ID: ${user.id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Balance: ${balanceInCents} cents = $${balanceInDollars.toFixed(2)}`);
    });

    console.log('\n═══════════════════════════════════════\n');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBalance();
