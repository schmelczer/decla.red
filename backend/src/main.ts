import { Server as IoServer } from 'socket.io';
import express from 'express';
import { Server } from 'http';
import cors from 'cors';
import { applyArrayPlugins, Random, serverInformationEndpoint, settings } from 'shared';
import minimist from 'minimist';
import { glMatrix } from 'gl-matrix';
import { GameServer } from './game-server';
import { defaultOptions } from './options';
import parser from 'socket.io-msgpack-parser';

glMatrix.setMatrixArrayType(Array);
applyArrayPlugins();

const optionOverrides = minimist(process.argv.slice(2));
const options = {
  ...defaultOptions,
  ...optionOverrides,
};

Random.seed = options.seed;

const app = express();
const server = new Server(app);
const io = new IoServer(server, {
  parser,
  maxHttpBufferSize: settings.maxInboundMessageBytes,
  cors: {
    origin: true,
    credentials: true,
  },
} as any);

const gameServer = new GameServer(io, options);

app.use(
  cors({
    origin: (_, callback) => {
      callback(null, true);
    },
    credentials: true,
  }),
);

app.get(serverInformationEndpoint, (_, res) => {
  res.json(gameServer.serverInfo);
});

server.listen(options.port, () => {
  console.info(`Server started on port ${options.port}`);
});

gameServer.start();
