import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { cacheService } from './cacheService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper functions for password hashing using Node.js crypto
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, hashedPassword: string): boolean {
  const [salt, hash] = hashedPassword.split(':');
  if (!salt || !hash) return false;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// Validation schemas
export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const LoginUserSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type LoginUserInput = z.infer<typeof LoginUserSchema>;

export class UserService {
  async createUser(data: CreateUserInput) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const hashedPassword = hashPassword(data.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        usdBalance: BigInt(500000) // $5000.00 in cents (starting bonus)
      },
      select: {
        id: true,
        email: true,
        usdBalance: true,
        createdAt: true
      }
    });

    // Initialize cache with starting balance
    const balance = Number(user.usdBalance) / 100;
    cacheService.updateUserBalanceCache(user.id, balance);

    return {
      ...user,
      balance: balance // Convert cents to dollars for display
    };
  }

  async loginUser(data: LoginUserInput) {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValidPassword = verifyPassword(data.password, user.password);
    
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        balance: Number(user.usdBalance) / 100 // Convert cents to dollars
      },
      token
    };
  }

  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        usdBalance: true,
        createdAt: true
      }
    });

    if (!user) return null;

    // Cache the balance for fast access
    const balance = Number(user.usdBalance) / 100;
    cacheService.updateUserBalanceCache(id, balance);

    return {
      ...user,
      balance // Convert cents to dollars
    };
  }

  async updateUserBalance(userId: string, newBalanceInDollars: number) {
    // Update cache immediately (instant response)
    cacheService.updateUserBalanceCache(userId, newBalanceInDollars);
    
    // Also update database immediately to ensure consistency
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { usdBalance: BigInt(Math.round(newBalanceInDollars * 100)) }
      });
    } catch (error) {
      console.error('Failed to update user balance in database:', error);
    }

    return {
      id: userId,
      balance: newBalanceInDollars
    };
  }

  // Fast balance check from cache
  async getUserBalanceFast(userId: string): Promise<number> {
    return await cacheService.getUserBalance(userId);
  }

  async getUserOrders(userId: string) {
    const orders = await prisma.userOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return orders;
  }

  async getClosedOrders(userId: string) {
    const closedOrders = await prisma.closedOrder.findMany({
      where: { userId },
      orderBy: { closedAt: 'desc' }
    });

    return closedOrders;
  }
}

export const userService = new UserService();