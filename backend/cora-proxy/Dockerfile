FROM node:20-alpine

WORKDIR /app

# Dependências para compilar better-sqlite3 (módulo nativo)
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm install --production

COPY index.js clone-db.js ./

# Os certificados devem ser montados como volume em /certs/
# - /certs/certificate.pem
# - /certs/private-key.pem

EXPOSE 3001

CMD ["node", "index.js"]
