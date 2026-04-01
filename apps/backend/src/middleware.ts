import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
    // Check if request is over HTTPS (consider proxy headers)
    const protocol = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol;
    const isHttps = protocol === "https:" || protocol === "https";

    // In production, enforce HTTPS for all requests (optional but recommended)
    // Uncomment if you want to force HTTPS redirects:
    // if (process.env.NODE_ENV === "production" && !isHttps) {
    //     const url = request.nextUrl.clone();
    //     url.protocol = "https:";
    //     return NextResponse.redirect(url, 301);
    // }

    // Handle CORS for API routes
    if (request.nextUrl.pathname.startsWith("/api")) {
        // Handle preflight OPTIONS request
        if (request.method === "OPTIONS") {
            return new NextResponse(null, {
                status: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers":
                        "Content-Type, Authorization, X-Retry-After-Refresh",
                    "Access-Control-Expose-Headers": "X-Token-Status",
                    "Access-Control-Max-Age": "86400",
                },
            });
        }

        // Add CORS headers to actual requests
        const response = NextResponse.next();
        response.headers.set("Access-Control-Allow-Origin", "*");
        response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        response.headers.set(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, X-Retry-After-Refresh"
        );
        response.headers.set("Access-Control-Expose-Headers", "X-Token-Status");

        // Security headers
        setSecurityHeaders(response, isHttps);

        return response;
    }

    // Apply security headers to all other routes (admin portal, etc.)
    const response = NextResponse.next();
    setSecurityHeaders(response, isHttps);
    return response;
}

function setSecurityHeaders(response: NextResponse, isHttps: boolean): void {
    // Prevent MIME type sniffing
    response.headers.set("X-Content-Type-Options", "nosniff");

    // Prevent clickjacking (deny embedding in iframes)
    response.headers.set("X-Frame-Options", "DENY");

    // Legacy XSS protection (browsers have moved to CSP, but still recommended)
    response.headers.set("X-XSS-Protection", "1; mode=block");

    // Control referrer information (balance privacy and functionality)
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    // Restrict browser features (disable unnecessary APIs, but allow camera for barcode scanning)
    response.headers.set("Permissions-Policy", "microphone=(), geolocation=(), interest-cohort=()");

    // Content Security Policy (basic - adjust based on your needs)
    // This is restrictive; you may need to relax for inline scripts/styles
    response.headers.set(
        "Content-Security-Policy",
        "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " + // unsafe-eval for Next.js dev
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: https:; " +
            "font-src 'self' data:; " +
            "connect-src 'self'; " +
            "frame-ancestors 'none'; " +
            "base-uri 'self'; " +
            "form-action 'self'"
    );

    // HSTS (HTTP Strict Transport Security) - only set if HTTPS
    // Forces browsers to always use HTTPS for 1 year
    if (isHttps) {
        response.headers.set(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains; preload"
        );
    }
}

export const config = {
    matcher: "/api/:path*",
};
