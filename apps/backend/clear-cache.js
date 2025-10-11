import Redis from 'ioredis';

const redis = new Redis();

async function clearCache() {
  try {
    const userId = '17f22892-3da9-4eb3-9d35-c514bb922285';
    
    console.log('🔄 Clearing Redis cache...');
    
    // Clear user balance cache
    await redis.del(`user:${userId}:balance`);
    console.log('✅ Cleared balance cache');
    
    // Clear user orders cache
    await redis.del(`user:${userId}:orders`);
    console.log('✅ Cleared orders cache');
    
    // Clear any other user-related cache
    const keys = await redis.keys(`user:${userId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`✅ Cleared ${keys.length} additional cache keys`);
    }
    
    console.log('✅ Cache cleared successfully');
    
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  } finally {
    await redis.disconnect();
  }
}

clearCache();