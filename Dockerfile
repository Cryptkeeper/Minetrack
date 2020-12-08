FROM node:12

EXPOSE 8080

COPY . /app
WORKDIR /app

RUN echo Installing \
	&& apt-get update \
	&& apt-get install git sqlite3 -y \
	&& npm install --build-from-source \
	&& npm run build

CMD node main.js
