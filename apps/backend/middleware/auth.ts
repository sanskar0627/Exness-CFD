import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { userService } from "../services/userService.js";

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function usermiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : req.cookies?.Authorization;

  if (!token) {
    return res.status(401).json({ message: "No authorization token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    
    // Verify user exists in database
    const user = await userService.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ message: "Invalid authorization token" });
  }
}