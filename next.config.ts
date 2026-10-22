import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js blocks cross-origin development resources by default. Do not use a
  // wildcard: preview hosts must be explicitly configured, and this does not
  // change production CORS or authentication behavior.
  allowedDevOrigins: [
    "127.0.0.1",
    ...(process.env.NEXT_DEV_ALLOWED_ORIGIN ? [process.env.NEXT_DEV_ALLOWED_ORIGIN] : []),
  ],
};

export default nextConfig;
