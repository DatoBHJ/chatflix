/** @type {import('next').NextConfig} */
const nextConfig = {
  // SECURITY: Removed all Polar tokens from client-side env
  // These should only be accessible on the server side
  // Client components now use /api/subscription/check instead
  reactStrictMode: process.env.NODE_ENV === 'production', // ✅ 개발환경에서 StrictMode 비활성화로 maximum update depth 에러 예방
  // 편집 후 전송 시 대화 전체(messages + parts)가 POST body로 전달됨. run_python_code 등으로 큰 base64가 포함되면 10MB 초과 → body 잘림 → JSON 파싱 에러 방지
  experimental: {
    middlewareClientMaxBodySize: '50mb',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'jgkrhazygwcvbzkwkhnj.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'auth.chatflix.app',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  // Turbopack 설정 (빈 객체로 webpack 에러 방지)
  turbopack: {
    root: __dirname,
  },
}

module.exports = nextConfig