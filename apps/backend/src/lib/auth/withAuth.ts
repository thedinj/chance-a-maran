import { AuthenticationError, AuthorizationError } from "@chance/core";
import { NextRequest, NextResponse } from "next/server";
import { db } from "../db/db";
import { verifyAccessToken } from "./jwt";
import type { JwtPayload } from "./types";

export type AuthenticatedRequest = NextRequest & {
    auth: JwtPayload;
};

export type RouteHandler<T = unknown> = (
    req: AuthenticatedRequest,
    context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse<T>>;

function authError(message: string, tokenStatus?: string): NextResponse {
    const res = NextResponse.json(
        { ok: false, error: { code: "AUTHENTICATION_ERROR", message }, serverTimestamp: new Date().toISOString() },
        { status: 401 }
    );
    if (tokenStatus) res.headers.set("X-Token-Status", tokenStatus);
    return res;
}

function authzError(message: string): NextResponse {
    return NextResponse.json(
        { ok: false, error: { code: "AUTHORIZATION_ERROR", message }, serverTimestamp: new Date().toISOString() },
        { status: 403 }
    );
}

/**
 * Wraps a route handler with JWT authentication.
 * Validates any JWT (user or guest).
 * For guest JWTs, additionally validates the player_token claim against the DB.
 */
export function withAuth(handler: RouteHandler, options?: { requireScopes?: string[] }) {
    return async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
        try {
            const authHeader = req.headers.get("authorization");
            if (!authHeader?.startsWith("Bearer ")) {
                return authError("Missing or invalid authorization header");
            }

            const token = authHeader.substring(7);
            const payload = verifyAccessToken(token);

            // Scope check
            if (options?.requireScopes) {
                const hasAll = options.requireScopes.every((s) => payload.scopes.includes(s));
                if (!hasAll) throw new AuthorizationError("Insufficient permissions");
            }

            // Guest token validation: compare player_token claim against DB
            if (payload.type === "guest") {
                if (!payload.playerToken || !payload.sub) {
                    return authError("Invalid guest token", "invalid");
                }
                const row = db
                    .prepare("SELECT player_token FROM session_players WHERE id = ?")
                    .get(payload.sub) as { player_token: string | null } | undefined;

                if (!row || row.player_token !== payload.playerToken) {
                    // Token was reset by host or player record not found
                    return authError("Guest session invalidated", "invalid");
                }
            }

            const authenticatedReq = req as AuthenticatedRequest;
            authenticatedReq.auth = payload;
            return handler(authenticatedReq, context);
        } catch (error) {
            if (error instanceof AuthenticationError) {
                return authError(error.message, "invalid");
            }
            if (error instanceof AuthorizationError) {
                return authzError(error.message);
            }
            return NextResponse.json(
                { ok: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" }, serverTimestamp: new Date().toISOString() },
                { status: 500 }
            );
        }
    };
}

/**
 * Wraps a route handler requiring admin privileges.
 * Checks is_admin on the users table (registered users only).
 */
export function withAdmin(handler: RouteHandler) {
    return withAuth(async (req, context) => {
        if (req.auth.type !== "user") {
            return authzError("Admin access requires a registered account");
        }
        const user = db
            .prepare("SELECT is_admin FROM users WHERE id = ?")
            .get(req.auth.sub) as { is_admin: number } | undefined;

        if (!user?.is_admin) {
            return authzError("Admin privileges required");
        }
        return handler(req, context);
    });
}
