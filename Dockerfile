FROM node:lts

WORKDIR /usr/src/app

COPY package*.json ./


RUN echo Installing dependencies \
	&& apt-get update \
	&& apt-get install sqlite3 -y \
	&& npm ci 

COPY . .
	
RUN npm run build

EXPOSE 8080


CMD node main.js
