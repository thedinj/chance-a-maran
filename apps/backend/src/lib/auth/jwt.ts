import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "crypto";
import { AuthenticationError } from "@chance/core";
import type { JwtPayload } from "./types";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";
const JWT_ISSUER = process.env.JWT_ISSUER || "chance";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "chance-api";

const ACCESS_TOKEN_TTL = parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS || "900");   // 15 minutes
const REFRESH_TOKEN_TTL = parseInt(process.env.REFRESH_TOKEN_TTL_SECONDS || "2592000"); // 30 days

export function generateAccessToken(payload: {
    userId: string;
    email: string;
    scopes: string[];
}): string {
    const jwtPayload: Omit<JwtPayload, "iat" | "exp"> = {
        sub: payload.userId,
        type: "user",
        email: payload.email,
        scopes: payload.scopes,
        iss: JWT_ISSUER,
        aud: JWT_AUDIENCE,
    };
    return jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function generateGuestToken(payload: {
    playerId: string;
    sessionId: string;
    playerToken: string;
}): string {
    const jwtPayload: Omit<JwtPayload, "iat" | "exp"> = {
        sub: payload.playerId,
        type: "guest",
        sessionId: payload.sessionId,
        playerToken: payload.playerToken,
        scopes: [],
        iss: JWT_ISSUER,
        aud: JWT_AUDIENCE,
    };
    // Guest tokens are session-scoped — use access token TTL (short-lived)
    return jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

/**
 * Generates a cryptographically random opaque refresh token string.
 * The raw token is returned to the caller (to be sent to the client and set as a cookie).
 * Only the SHA-256 hash is stored in the database.
 */
export function generateRawRefreshToken(): string {
    return randomBytes(40).toString("hex");
}

export function hashRefreshToken(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
}

export function verifyAccessToken(token: string): JwtPayload {
    try {
        const decoded = jwt.verify(token, JWT_SECRET, {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        });
        return decoded as JwtPayload;
    } catch {
        throw new AuthenticationError("Invalid or expired token");
    }
}

export function getRefreshTokenExpiry(): Date {
    return new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);
}
