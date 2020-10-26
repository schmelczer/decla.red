FROM node:14.13.0-alpine3.10

RUN npm i -g declared-server

EXPOSE 3000

CMD ["--port=3000", "--name=Docker server", "--seed=500"]
ENTRYPOINT [ "NODE_ENV=production node", "declared-server" ]
