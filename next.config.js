/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ESLint 검사를 완전히 비활성화
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig