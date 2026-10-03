# SPA Vite build → nginx (proxy /api al backend)
# Build context: raíz del repo (ver docker-compose.yml)
FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY fronted/package.json fronted/package-lock.json ./
RUN npm ci

COPY fronted/ .
RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
