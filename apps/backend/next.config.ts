import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    assetPrefix: process.env.NODE_ENV === "production" ? "/admin" : undefined,
    typescript: {
        // Type checking runs on dev machines and in CI — skip it on the Pi
        // where tsc OOMs under Next.js's build process.
        ignoreBuildErrors: true,
    },
};

export default nextConfig;
