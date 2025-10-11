import { userService } from './services/userService.js';
import prisma from './lib/prisma.js';

async function testAPI() {
  try {
    console.log('=== DIRECT API TEST ===');
    
    const userId = 'e27d0639-b16d-4e36-bfe7-3ad36ab4b95d'; // New user
    
    console.log('\n1. Database direct query:');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { usdBalance: true }
    });
    console.log('Database balance (cents):', user?.usdBalance ? Number(user.usdBalance) : 'null');
    console.log('Database balance (dollars):', user?.usdBalance ? Number(user.usdBalance) / 100 : 'null');
    
    console.log('\n2. UserService getUserBalanceFast:');
    const fastBalance = await userService.getUserBalanceFast(userId);
    console.log('Fast balance (dollars):', fastBalance);
    
    console.log('\n3. UserService getUserById:');
    const userById = await userService.getUserById(userId);
    console.log('getUserById balance:', userById?.balance);
    
    console.log('\n4. API Response simulation:');
    const apiResponse = {
      balance: fastBalance,
      usd_balance: fastBalance * 100
    };
    console.log('API would return:', apiResponse);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAPI();