import { createClient } from 'redis';

const client = createClient({
  url: 'redis://localhost:6379'
});

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();

console.log('🧹 Clearing corrupted price data from Redis...');

const deleted = await client.del(['price:BTC', 'price:ETH', 'price:SOL']);
console.log(`✅ Deleted ${deleted} price keys from Redis`);

await client.quit();
console.log('✅ Redis cache cleared successfully!');
