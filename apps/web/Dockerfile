# ===================================================================
# MenuPick Web App - Dockerfile (Next.js)
# ===================================================================
# 빌드 단계
FROM node:22-alpine AS builder

WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

# 의존성 설치
RUN npm ci

# 소스 코드 복사
COPY apps/web ./apps/web

# Next.js 빌드
RUN npm run build --workspace=apps/web

# ===================================================================
# 실행 단계
FROM node:22-alpine

WORKDIR /app

# 프로덕션 환경 설정
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1

# 패키지 파일 복사
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

# 프로덕션 의존성만 설치
RUN npm ci --only=production && \
    npm cache clean --force

# 빌드된 Next.js 복사
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY apps/web/next.config.js ./apps/web/

# 헬스 체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

# 포트 노출
EXPOSE 3000

# 웹 앱 시작
WORKDIR /app/apps/web
CMD ["npm", "start"]
