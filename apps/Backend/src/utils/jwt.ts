import type { JWTPayload } from ".././types";
import * as jwt from "jsonwebtoken";

export function generateToken(userId: string): string {
  const metadata: JWTPayload = {
    userId: userId,
  };
  //For typeescript to check before that it is thier  not empty same for expire in
  const secret = Bun.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }
  const expiresIn = Bun.env.TOKEN_EXPIRY || "7d";
  //geanrating jwt token
  const accessToken: string = jwt.sign(metadata, secret, {
    expiresIn: expiresIn as any,
  });

  console.log(`[JWT GENERATED] User: ${userId} | Expires: ${expiresIn}`);
  return accessToken;
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const secret = Bun.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }

    const decoded = jwt.verify(token, secret) as JWTPayload;
    console.log(`[JWT VERIFIED] User: ${decoded.userId} | Token Valid`);
    return decoded;
  } catch (err) {
    console.error("Invalid Token!", err);
    return null;
  }
}
