import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker deploy copies only .next/standalone — no node_modules in the image.
  output: "standalone",
};

export default nextConfig;
