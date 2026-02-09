FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY index.js ./

# Os certificados devem ser montados como volume em /certs/
# - /certs/certificate.pem
# - /certs/private-key.pem

EXPOSE 3001

CMD ["node", "index.js"]
