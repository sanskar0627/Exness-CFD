import { cacheService } from './services/cacheService.js';
import { userService } from './services/userService.js';

async function testBalance() {
  try {
    await cacheService.initialize();
    
    const userId = '17f22892-3da9-4eb3-9d35-c514bb922285'; // Your original user
    const newUserId = 'e27d0639-b16d-4e36-bfe7-3ad36ab4b95d'; // New user
    
    console.log('=== TESTING BALANCE API ===');
    
    // Test cache service directly
    console.log('\n1. Testing cache service directly:');
    const cachedBalance1 = await cacheService.getUserBalance(userId);
    const cachedBalance2 = await cacheService.getUserBalance(newUserId);
    console.log('Original user cached balance:', cachedBalance1);
    console.log('New user cached balance:', cachedBalance2);
    
    // Test user service
    console.log('\n2. Testing user service:');
    const userBalance1 = await userService.getUserBalanceFast(userId);
    const userBalance2 = await userService.getUserBalanceFast(newUserId);
    console.log('Original user service balance:', userBalance1);
    console.log('New user service balance:', userBalance2);
    
    // Test getUserById
    console.log('\n3. Testing getUserById:');
    const user1 = await userService.getUserById(userId);
    const user2 = await userService.getUserById(newUserId);
    console.log('Original user data:', user1?.balance);
    console.log('New user data:', user2?.balance);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await cacheService.shutdown();
    process.exit(0);
  }
}

testBalance();