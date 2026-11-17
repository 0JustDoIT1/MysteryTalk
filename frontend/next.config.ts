import { join } from 'node:path';
import type { NextConfig } from 'next';

// 브라우저는 같은 출처의 /api/* 만 호출하고, Next 서버가 NestJS 백엔드로 프록시한다.
// 같은 출처라서 HttpOnly 쿠키(게스트·로그인)가 그대로 오가고 CORS 설정이 필요 없다.
const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';

const nextConfig: NextConfig = {
  // 운영 이미지(frontend/Dockerfile)용 독립 실행 출력. 작업 공간 루트의 node_modules까지 따라가 담는다
  output: 'standalone',
  // next 명령은 frontend 폴더에서 실행된다(npm -w frontend)
  outputFileTracingRoot: join(process.cwd(), '..'),
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backendUrl}/:path*` }];
  },
};

export default nextConfig;
