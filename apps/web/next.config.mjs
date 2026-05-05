/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { typedRoutes: true },
  // We re-export workspace TS sources directly (no pre-build step) for faster
  // dev iteration; Next 15 transpiles them via SWC.
  transpilePackages: ['@app-bus/api-client', '@app-bus/types'],
  poweredByHeader: false,
  reactStrictMode: true,
};
export default nextConfig;
