FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Pre-download the embedding model so it's cached in the image
RUN node scripts/precache-model.mjs

EXPOSE 3000

CMD ["npx", "tsx", "src/channels/telegram.ts"]
