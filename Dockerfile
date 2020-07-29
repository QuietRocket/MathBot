FROM node:14.3.0-buster-slim AS build
USER node
WORKDIR /home/node
COPY package.json package-lock.json ./
RUN npm install
COPY . .
CMD [ "npm", "start" ]