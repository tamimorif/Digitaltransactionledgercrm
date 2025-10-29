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

export default nextConfig;
