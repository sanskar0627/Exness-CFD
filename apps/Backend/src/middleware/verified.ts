import type { Request, Response, NextFunction } from "express";
import { prisma } from "database";

/**
 * Blocks the action unless the user's email is verified.
 * Must run AFTER authMiddleware (needs req.userId).
 */
export async function requireVerified(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { userId: req.userId! },
      select: { emailVerified: true },
    });

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    if (!user.emailVerified) {
      res.status(403).json({
        error: "Email not verified. Please verify your email to start trading.",
        needsVerification: true,
      });
      return;
    }

    next();
  } catch (err) {
    console.error("[VERIFIED] Middleware error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
