import jwt from "jsonwebtoken";
import type { JWTPayload } from "../types";


export function Verifytokenws(token: string): JWTPayload | null {
    try {
        if (!token || token.trim() === "") {
            console.error("[JWT WS] Token is empty or undefined");
            return null;
        }
        
        const secret = Bun.env.JWT_SECRET;
        if (!secret) {
            console.error("[JWT WS] JWT_SECRET is not defined in environment variables");
            console.error("[JWT WS] Please set JWT_SECRET in apps/Websocket/.env file");
            return null;
        }
        
        // Log first 4 chars of secret for debugging (safe to show)
        console.log(`[JWT WS] Using JWT_SECRET starting with: ${secret.substring(0, 4)}...`);
        console.log(`[JWT WS] Token starts with: ${token.substring(0, 20)}...`);
        
        const decoded = jwt.verify(token, secret) as JWTPayload;
        console.log(`[JWT WS VERIFIED] User: ${decoded.userId} | Token Valid`);
        return decoded;
    } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            console.error("[JWT WS] Token has expired:", err.message);
        } else if (err instanceof jwt.JsonWebTokenError) {
            console.error("[JWT WS] Invalid token - JWT verification failed:", err.message);
            console.error("[JWT WS] This usually means JWT_SECRET mismatch between Backend and WebSocket");
        } else {
            console.error("[JWT WS] Failed to verify the token:", err);
        }
        return null;
    }
}