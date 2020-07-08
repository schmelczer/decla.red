FROM node:latest as build

WORKDIR /home/node
COPY . .
RUN npm install
RUN npm run build

FROM nginx:alpine
COPY --from=build /home/node/dist/ /usr/share/nginx/html
