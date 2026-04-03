import rateLimit from "next-rate-limit";
import { NextRequest, NextResponse } from "next/server";

// Cache limiter instances by config so the LRU state persists across requests
const limiters = new Map<string, ReturnType<typeof rateLimit>>();

function getLimiter(maxAttempts: number, windowMs: number) {
    const key = `${maxAttempts}:${windowMs}`;
    if (!limiters.has(key)) {
        limiters.set(key, rateLimit({ interval: windowMs, uniqueTokenPerInterval: 500 }));
    }
    return limiters.get(key)!;
}

export function checkRateLimit(
    req: NextRequest,
    maxAttempts: number,
    windowMs: number
): NextResponse | null {
    try {
        getLimiter(maxAttempts, windowMs).checkNext(req, maxAttempts);
        return null;
    } catch {
        const retryAfter = Math.ceil(windowMs / 1000);
        return NextResponse.json(
            {
                ok: false,
                error: {
                    code: "RATE_LIMIT_EXCEEDED",
                    message: "Too many attempts. Please try again later.",
                },
                serverTimestamp: new Date().toISOString(),
            },
            {
                status: 429,
                headers: { "Retry-After": retryAfter.toString() },
            }
        );
    }
}
