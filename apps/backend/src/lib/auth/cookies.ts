import { NextResponse } from "next/server";

const REFRESH_TOKEN_TTL = parseInt(process.env.REFRESH_TOKEN_TTL_SECONDS || "2592000"); // 30 days

const COOKIE_NAME = "refresh_token";

export function setRefreshCookie(response: NextResponse, rawToken: string): void {
    response.cookies.set({
        name: COOKIE_NAME,
        value: rawToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/auth",
        maxAge: REFRESH_TOKEN_TTL,
    });
}

export function clearRefreshCookie(response: NextResponse): void {
    response.cookies.set({
        name: COOKIE_NAME,
        value: "",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/auth",
        maxAge: 0,
    });
}

/** Read refresh token from cookie (web) or request body (native Capacitor).
 *  When the caller sends X-Token-Transport: body it manages tokens itself
 *  (e.g. admin portal, native Capacitor) — skip the cookie entirely so a
 *  mobile-web session cookie on the same localhost origin cannot interfere. */
export function readRefreshToken(
    req: import("next/server").NextRequest,
    body?: Record<string, unknown>
): string | null {
    const bodyToken = body?.refreshToken as string | undefined;
    if (req.headers.get("X-Token-Transport") === "body") {
        return bodyToken ?? null;
    }
    return req.cookies.get(COOKIE_NAME)?.value ?? bodyToken ?? null;
}
