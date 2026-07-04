# ===================================================================
# MenuPick API Server - Dockerfile (NestJS)
# ===================================================================
# 빌드 단계
FROM node:22-alpine AS builder

WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# 의존성 설치
RUN npm ci

# 소스 코드 복사
COPY apps/api ./apps/api

# TypeScript 컴파일
RUN npm run build --workspace=apps/api

# ===================================================================
# 실행 단계
FROM node:22-alpine

WORKDIR /app

# 프로덕션 환경 설정
ENV NODE_ENV=production

# 패키지 파일 복사
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# 프로덕션 의존성만 설치
RUN npm ci --only=production && \
    npm cache clean --force

# 빌드된 애플리케이션 복사
COPY --from=builder /app/apps/api/dist ./dist

# 헬스 체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/v1', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# 포트 노출
EXPOSE 8080

# 앱 시작
CMD ["node", "dist/main.js"]
