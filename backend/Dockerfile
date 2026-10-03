# AdonisJS API — Node 24 Debian slim (engines >=24; bcrypt más estable que Alpine)
FROM node:24-bookworm-slim

WORKDIR /app

# Herramientas mínimas por si hace falta compilar bcrypt u otros addons nativos
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# tsx está en devDependencies; se necesita para arrancar TypeScript sin build previo
RUN npm ci

COPY . .

# Asegura directorios de storage (montados como volumen en compose)
RUN mkdir -p storage/attachments storage/system

ENV HOST=0.0.0.0
ENV PORT=3333
ENV NODE_ENV=production

EXPOSE 3333

CMD ["node", "--import=tsx", "bin/server.ts"]
