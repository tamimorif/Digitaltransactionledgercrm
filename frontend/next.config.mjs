import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['lucide-react'],
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  // Output standalone for Docker/serverless deployment
  output: 'standalone',
  // Disable eslint during production build (optional)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript build errors (optional - remove in production)
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default withPWA(nextConfig);
