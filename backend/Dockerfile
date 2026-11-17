# 백엔드(NestJS) 운영 이미지. 저장소 루트에서 빌드한다:
#   docker build -f backend/Dockerfile -t mysterytalk-backend .
# 비공개 사건 데이터와 비밀값은 이미지에 넣지 않는다(D85). 사건 적재는 docs/DEPLOY.md 참고.
FROM node:22-slim AS build
WORKDIR /app
# npm 11은 NestJS 12 템플릿 설치 중 내부 오류가 나서 저장소가 쓰는 npm 12로 맞춘다(CLAUDE.md Commands)
RUN npm install -g npm@12.2.2
# 작업 공간 목록과 잠금 파일이 맞아야 해서 프론트는 package.json만 넣는다
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace @mysterytalk/shared --workspace backend --include-workspace-root
COPY shared shared
COPY backend backend
RUN npm run build -w @mysterytalk/shared && npm run build -w backend

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
# 마이그레이션(prisma CLI)과 운영 명령(정리·통계, tsx)을 컨테이너에서 돌릴 수 있게 의존성을 그대로 둔다
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/shared/package.json shared/
COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/backend backend
WORKDIR /app/backend
USER node
EXPOSE 4000
CMD ["node", "dist/main"]
