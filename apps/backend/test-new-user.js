import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function simulateNewUserFlow() {
  try {
    console.log('=== SIMULATING NEW USER CREATION ===');
    
    // Simulate what the createUser function does
    const mockEmail = `test${Date.now()}@example.com`;
    const mockPassword = 'hashedpassword123';
    
    console.log('1. Creating user in database...');
    const user = await prisma.user.create({
      data: {
        email: mockEmail,
        password: mockPassword,
        usdBalance: BigInt(500000) // $5000.00 in cents (starting bonus)
      },
      select: {
        id: true,
        email: true,
        usdBalance: true,
        createdAt: true
      }
    });
    
    console.log('Created user:', {
      id: user.id.substring(0, 8) + '...',
      email: user.email,
      balanceCents: Number(user.usdBalance),
      balanceDollars: Number(user.usdBalance) / 100,
      createdAt: user.createdAt
    });
    
    // Test what the API would return for this user
    const balanceInDollars = Number(user.usdBalance) / 100;
    const apiResponse = {
      balance: balanceInDollars,
      usd_balance: balanceInDollars * 100
    };
    
    console.log('\n2. API response for this user would be:');
    console.log('balance (dollars):', apiResponse.balance);
    console.log('usd_balance (cents):', apiResponse.usd_balance);
    
    // Test what frontend would display
    console.log('\n3. Frontend display logic:');
    console.log('data.usd_balance:', apiResponse.usd_balance);
    console.log('Frontend would show:', apiResponse.usd_balance, '(as if this is dollars)');
    console.log('But this should be:', apiResponse.usd_balance / 100, 'dollars');
    
    // Clean up - delete the test user
    await prisma.user.delete({
      where: { id: user.id }
    });
    console.log('\n✅ Test user cleaned up');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

simulateNewUserFlow();