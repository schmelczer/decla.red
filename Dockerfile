FROM node:14.13.0-alpine3.10 as build

COPY . .
RUN npm i -g concurrently
RUN yarn && yarn run build


FROM node:14.13.0-alpine3.10

COPY backend/package.json .
RUN npm install --production

COPY --from=build backend/dist/main.js main.js 

EXPOSE 3000
CMD [ "node", "main.js" ]
