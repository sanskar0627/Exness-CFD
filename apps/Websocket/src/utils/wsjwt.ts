import jwt from "jsonwebtoken";
import type { JWTPayload } from "../types";


export function Verifytokenws(token: string): JWTPayload | null {
    try {
        const secret = Bun.env.JWT_SECRET;
        if (!secret) {
            throw new Error("JWT_SECRET is not defined in environment variables");
        }
        const decoded = jwt.verify(token, secret) as JWTPayload;
        console.log(`[JWT  WS VERIFIED] User: ${decoded.userId} | Token Valid`);
        return decoded;
    } catch (err) {
        console.error("Failed to verify the token",err);
        return null;
    }

}