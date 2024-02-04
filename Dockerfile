FROM node:18.19.1-alpine3.19

ARG TINI_VER="0.19.0"
ARG SQLITE_CLI_VER="3.45.1"

WORKDIR /app

COPY . .

RUN apk add --no-cache bash tini="$TINI_VER" sqlite="$SQLITE_CLI_VER"
RUN <<EOT bash

set -ex

(deluser --remove-home xfs 2>/dev/null || true)
(deluser --remove-home www-data 2>/dev/null || true)
(delgroup www-data 2>/dev/null || true)
(delgroup xfs 2>/dev/null || true)
addgroup -S -g 33 www-data
adduser -S -D -u 33 -s /sbin/nologin -h /var/www -G www-data www-data

npm install
npm run build

chown -R www-data:www-data /app
chmod 750 /app

EOT

USER www-data:www-data

EXPOSE 8080

VOLUME /app/data

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "main.js"]
