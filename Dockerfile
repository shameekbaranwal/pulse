FROM oven/bun:1 AS base

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile

COPY src ./src

EXPOSE 4010

CMD ["bun", "src/index.ts"]
