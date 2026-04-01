import rateLimit from "next-rate-limit";
import { NextRequest, NextResponse } from "next/server";

/**
 * Rate limiting middleware for Next.js API routes using next-rate-limit
 * @param req - Next.js request object
 * @param maxAttempts - Maximum attempts allowed
 * @param windowMs - Time window in milliseconds
 * @returns Response if rate limited, null otherwise
 */
export async function checkRateLimit(
    req: NextRequest,
    maxAttempts: number,
    windowMs: number
): Promise<NextResponse | null> {
    const limiter = rateLimit({
        interval: windowMs,
        uniqueTokenPerInterval: 500, // Max number of unique IPs to track
    });

    try {
        await limiter.checkNext(req, maxAttempts);
        return null; // Not rate limited
    } catch {
        // Rate limited
        const retryAfter = Math.ceil(windowMs / 1000);

        return NextResponse.json(
            {
                code: "RATE_LIMIT_EXCEEDED",
                message: "Too many attempts. Please try again later.",
                details: {
                    retryAfter: retryAfter,
                },
            },
            {
                status: 429,
                headers: {
                    "Retry-After": retryAfter.toString(),
                },
            }
        );
    }
}
