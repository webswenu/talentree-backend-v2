# Imagen del backend (la construye docker-compose en el servidor).
# Node 22 LTS: las dependencias actuales exigen Node >= 20 (AWS SDK) y >= 22 (nanoid 6, vía docx).
FROM node:22-alpine

WORKDIR /app

# Cliente de PostgreSQL para chequeos y FFmpeg para procesar video
RUN apk add --no-cache postgresql-client ffmpeg

# Dependencias exactas del lockfile, sin scripts de instalación (bcrypt 6 trae binarios precompilados)
COPY package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY . .

# Compilado una vez al construir: antes corría `nest start --watch` (modo desarrollo) en producción
RUN npx nest build

EXPOSE 3000

CMD ["node", "dist/main"]
