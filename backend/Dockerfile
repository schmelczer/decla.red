FROM node:14.13.0-alpine3.10

COPY package.json .

RUN yarn install --production=true

COPY dist/main.js main.js

EXPOSE 3000

CMD [ "node", "main.js" ]
