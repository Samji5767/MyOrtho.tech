FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# next.config.js uses output: 'export' with distDir: 'next-build', which means
# the build produces a static site in next-build/ — not a Next.js server app.
# 'next start' explicitly errors with static exports; serve the files instead.
FROM node:22-alpine AS runner
WORKDIR /app

# Run as non-root user
RUN addgroup -S app && adduser -S app -G app

RUN npm install -g serve
COPY --from=builder /app/next-build ./next-build

RUN chown -R app:app /app
USER app

EXPOSE 3000
CMD ["serve", "next-build", "-p", "3000", "--no-clipboard"]
