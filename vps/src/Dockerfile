FROM mcr.microsoft.com/playwright:v1.59.1-jammy AS deps
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /app

COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM mcr.microsoft.com/playwright:v1.59.1-jammy AS runner
WORKDIR /app

ENV NODE_ENV=production
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=build /app/dist ./dist
COPY src/.env ./src/.env

EXPOSE 3000
CMD ["node", "dist/index.js"]