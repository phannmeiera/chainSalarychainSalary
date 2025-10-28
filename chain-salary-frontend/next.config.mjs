/** @type {import('next').NextConfig} */
const isExport = true;
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const nextConfig = {
  reactStrictMode: true,
  output: isExport ? "export" : undefined,
  images: { unoptimized: true },
  trailingSlash: true,
  // Configure basePath/assetPrefix for GitHub Pages project site
  basePath: basePath || undefined,
  assetPrefix: basePath ? `${basePath}/` : undefined,
};

export default nextConfig;






