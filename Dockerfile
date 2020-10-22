FROM node:14.13.0-alpine3.10 as build
RUN npm install -g npm@7 

WORKDIR /app
COPY . .

RUN npm install --legacy-peer-deps
RUN npm run build


FROM node:14.13.0-alpine3.10

WORKDIR /app

ENV NODE_ENV=production
COPY backend/package.json .
RUN npm install --production

COPY --from=build backend/dist/main.js main.js 

EXPOSE 3000

CMD ["--port=3000", "--name=Docker server", "--seed=500"]
ENTRYPOINT [ "node", "main.js" ]
