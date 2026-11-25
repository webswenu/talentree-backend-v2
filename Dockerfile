# Development Dockerfile
FROM node:18-alpine

WORKDIR /app

# La imagen corre sin root (CKV_DOCKER_3): node es el usuario sin privilegios
# que trae la imagen oficial.
RUN chown node:node /app

# Install PostgreSQL client for health checks and FFmpeg for video processing
RUN apk add --no-cache postgresql-client ffmpeg

# Copy package files
COPY --chown=node:node package*.json ./
USER node

# Install dependencies
RUN npm install

# Copy source code
COPY --chown=node:node . .

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "run", "start:dev"]
