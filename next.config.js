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
}

module.exports = withPWA(nextConfig)