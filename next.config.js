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
  env: {
    POLAR_DEV_ACCESS_TOKEN: process.env.POLAR_DEV_ACCESS_TOKEN,
    POLAR_DEV_PRODUCT_ID: process.env.POLAR_DEV_PRODUCT_ID,
    POLAR_DEV_PRODUCT_PRICE_ID: process.env.POLAR_DEV_PRODUCT_PRICE_ID,
    POLAR_DEV_DISCOUNT_ID: process.env.POLAR_DEV_DISCOUNT_ID,
    POLAR_DEV_DISCOUNT_CODE: process.env.POLAR_DEV_DISCOUNT_CODE,
    POLAR_DEV_BASE_URL: process.env.POLAR_DEV_BASE_URL,
    POLAR_PROD_ACCESS_TOKEN: process.env.POLAR_PROD_ACCESS_TOKEN,
    POLAR_PROD_PRODUCT_ID: process.env.POLAR_PROD_PRODUCT_ID,
    POLAR_PROD_PRODUCT_PRICE_ID: process.env.POLAR_PROD_PRODUCT_PRICE_ID,
    POLAR_PROD_DISCOUNT_ID: process.env.POLAR_PROD_DISCOUNT_ID,
    POLAR_PROD_DISCOUNT_CODE: process.env.POLAR_PROD_DISCOUNT_CODE,
    POLAR_PROD_BASE_URL: process.env.POLAR_PROD_BASE_URL,
  },
  reactStrictMode: true,
  images: {
    domains: ['jgkrhazygwcvbzkwkhnj.supabase.co'],
  }
}

module.exports = withPWA(nextConfig)