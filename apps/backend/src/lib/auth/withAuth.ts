import { AuthenticationError, AuthorizationError, JwtPayload } from "@basket-bot/core";
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "./jwt";

export type AuthenticatedRequest = NextRequest & {
    auth: JwtPayload;
};

export type RouteHandler<T = unknown> = (
    req: AuthenticatedRequest,
    context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse<T>>;

export function withAuth(handler: RouteHandler, options?: { requireScopes?: string[] }) {
    return async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
        try {
            const authHeader = req.headers.get("authorization");
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                throw new AuthenticationError("Missing or invalid authorization header");
            }

            const token = authHeader.substring(7);
            const payload = verifyAccessToken(token);

            // Check required scopes
            if (options?.requireScopes) {
                const hasRequiredScopes = options.requireScopes.every((scope) =>
                    payload.scopes.includes(scope)
                );
                if (!hasRequiredScopes) {
                    throw new AuthorizationError("Insufficient permissions");
                }
            }

            // Attach auth payload to request
            const authenticatedReq = req as AuthenticatedRequest;
            authenticatedReq.auth = payload;

            return handler(authenticatedReq, context);
        } catch (error) {
            if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
                const response = NextResponse.json(
                    { code: error.code, message: error.message },
                    { status: error instanceof AuthenticationError ? 401 : 403 }
                );

                // Add header to help client distinguish token failures
                if (error instanceof AuthenticationError) {
                    response.headers.set("X-Token-Status", "invalid");
                }

                return response;
            }
            return NextResponse.json(
                { code: "INTERNAL_ERROR", message: "Internal server error" },
                { status: 500 }
            );
        }
    };
}
