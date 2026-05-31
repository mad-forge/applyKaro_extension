/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Ensure pdf parser files are present in server runtime bundles on Next 14.
    serverComponentsExternalPackages: ["pdf-parse"],
    outputFileTracingIncludes: {
      "/api/parse-resume": ["./node_modules/pdf-parse/**/*", "../node_modules/pdf-parse/**/*"]
    }
  }
}

module.exports = nextConfig
