import createNextIntlPlugin from "next-intl/plugin"
import { execFileSync } from "node:child_process"
import type { NextConfig } from "next"
import nextra from "nextra"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")
const withNextra = nextra({
    contentDirBasePath: "/wiki",
    search: { codeblocks: false },
})

function getBuildVersion() {
    try {
        const commitCount = execFileSync(
            "git",
            ["rev-list", "--count", "HEAD"],
            {
                encoding: "utf8",
                stdio: ["ignore", "pipe", "ignore"],
            }
        ).trim()
        return `1.0.${commitCount}`
    } catch {
        return "1.0.0"
    }
}

const nextConfig: NextConfig = {
    // Static pages read several server-side data sources. Next's defaults can
    // fan this out to 8 renders for every CPU worker (88 concurrent renders on
    // a 11-core build host), which overloads those sources and causes unrelated
    // pages to hit the static-generation timeout together.
    staticPageGenerationTimeout: 180,
    env: {
        NEXT_PUBLIC_APP_VERSION: getBuildVersion(),
    },
    experimental: {
        cpus: 2,
        staticGenerationMaxConcurrency: 1,
        staticGenerationMinPagesPerWorker: 25,
        optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
    },
    turbopack: {},

    cacheComponents: false,

    // Image optimization
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "ui.shadcn.com",
            },
            {
                protocol: "https",
                hostname: "images.unsplash.com",
            },
            {
                protocol: "https",
                hostname: "avatars.githubusercontent.com",
            },
            {
                protocol: "https",
                hostname: "cdn.discordapp.com",
            },
        ],
        formats: ["image/webp", "image/avif"],
        qualities: [70, 90],
        minimumCacheTTL: 60 * 60 * 24 * 31,
    },

    // Headers for better security and performance
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    {
                        key: "X-Frame-Options",
                        value: "DENY",
                    },
                    {
                        key: "X-Content-Type-Options",
                        value: "nosniff",
                    },
                    {
                        key: "Referrer-Policy",
                        value: "origin-when-cross-origin",
                    },
                ],
            },
        ]
    },

    // Redirects for better SEO
    async redirects() {
        return [
            {
                source: "/home",
                destination: "/en/dashboard",
                permanent: true,
            },
        ]
    },
}

export default withNextra(withNextIntl(nextConfig))
