# Development Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install PostgreSQL client for health checks and FFmpeg for video processing
RUN apk add --no-cache postgresql-client ffmpeg

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "run", "start:dev"]
