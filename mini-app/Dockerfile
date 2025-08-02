# Сборка
FROM node:20-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Производственный образ
FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/out ./out
COPY --from=builder /app/package*.json ./

# Установка простого HTTP сервера для статики
RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "-s", "out", "-l", "3000"]