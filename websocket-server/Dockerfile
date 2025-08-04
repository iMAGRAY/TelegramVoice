FROM node:20-alpine

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем остальные файлы
COPY . .

# Собираем TypeScript
RUN npm run build

# Expose порт
EXPOSE 8080

# Запускаем сервер
CMD ["npm", "start"]