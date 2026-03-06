FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Pre-download the embedding model so it's cached in the image
RUN npx tsx -e "import { pipeline } from '@xenova/transformers'; await pipeline('feature-extraction', 'Xenova/multilingual-e5-large');"

EXPOSE 3000

CMD ["npx", "tsx", "src/channels/telegram.ts"]
