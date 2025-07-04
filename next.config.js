const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ESLint 검사를 완전히 비활성화
    ignoreDuringBuilds: true,
  },
  // SECURITY: Removed all Polar tokens from client-side env
  // These should only be accessible on the server side
  // Client components now use /api/subscription/check instead
  reactStrictMode: true,
  images: {
    domains: [
      'jgkrhazygwcvbzkwkhnj.supabase.co',
      'lh3.googleusercontent.com'
    ],
  }
}

module.exports = withPWA(nextConfig)