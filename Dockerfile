FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate
RUN pnpm config set node-linker hoisted

FROM base AS deps
# Copier les fichiers de configuration du workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/mail/package.json ./apps/mail/package.json

# Fetch des dépendances
RUN pnpm fetch

# Copier tout le code source
COPY . .

# Installer toutes les dépendances du monorepo
RUN pnpm install --frozen-lockfile
RUN pnpm --filter mail build

# Nettoyer et réinstaller seulement les dépendances de production pour mail
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN addgroup -S app && adduser -S app -G app

ENV NODE_ENV=production

# Copier les fichiers compilés depuis le build
COPY --from=deps /app/apps/mail/dist ./dist
COPY --from=deps /app/apps/mail/package.json ./package.json

# Copier les node_modules de la racine (workspace)
COPY --from=deps /app/node_modules ./node_modules

USER app
EXPOSE 3000
CMD ["node", "dist/index.js"]
