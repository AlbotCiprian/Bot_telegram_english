FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

RUN npm install

EXPOSE 3000

CMD ["npm", "run", "dev"]
