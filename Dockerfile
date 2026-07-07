# 使用官方 Node.js LTS 24 Alpine 映像作為基礎
FROM node:24-alpine AS base

# 安裝依賴項所需的套件
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴項
FROM base AS deps
RUN npm ci --only=production

# 構建階段
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .

# 設置環境變數
ENV NEXT_TELEMETRY_DISABLED 1

# 構建應用
RUN npm run build

# 生產階段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# 創建非 root 用戶
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 複製構建產物
COPY --from=builder /app/public ./public

# 設置正確的權限
RUN mkdir .next
RUN chown nextjs:nodejs .next

# 複製構建的應用
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# 暴露端口
EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# 啟動應用
CMD ["node", "server.js"]