# 프론트(Next.js) 운영 이미지. 저장소 루트에서 빌드한다:
#   docker build -f frontend/Dockerfile --build-arg BACKEND_URL=http://backend:4000 -t mysterytalk-frontend .
# /api/* 를 백엔드로 넘기는 주소(BACKEND_URL)와 NEXT_PUBLIC_* 값은 빌드할 때 고정된다.
FROM node:22-slim AS build
WORKDIR /app
RUN npm install -g npm@12.2.2
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace @mysterytalk/shared --workspace frontend --include-workspace-root
COPY shared shared
COPY frontend frontend
ARG BACKEND_URL=http://backend:4000
ARG NEXT_PUBLIC_BUG_FORM_URL=
ENV BACKEND_URL=$BACKEND_URL NEXT_PUBLIC_BUG_FORM_URL=$NEXT_PUBLIC_BUG_FORM_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @mysterytalk/shared && npm run build -w frontend

FROM node:22-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
# standalone 출력: 서버와 필요한 node_modules만. 정적 파일·public은 따로 복사한다
COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static frontend/.next/static
COPY --from=build /app/frontend/public frontend/public
USER node
EXPOSE 3000
CMD ["node", "frontend/server.js"]
