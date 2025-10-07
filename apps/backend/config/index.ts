import { z } from 'zod';

// Simple dotenv replacement
try {
  const fs = await import('fs');
  const path = await import('path');
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    const lines = envFile.split('\n');
    for (const line of lines) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (value && !process.env[key.trim()]) {
          process.env[key.trim()] = value;
        }
      }
    }
  }
} catch (error) {
  console.warn('Could not load .env file:', error);
}

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32),
  INITIAL_BALANCE_USD: z.string().default('5000').transform(Number),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
});

export const config = configSchema.parse(process.env);