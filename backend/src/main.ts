import ioserver, { Socket } from 'socket.io';
import express from 'express';
import { Server } from 'http';
import cors from 'cors';
import {
  applyArrayPlugins,
  Random,
  TransportEvents,
  deserialize,
  StepCommand,
  settings,
} from 'shared';
import './index.html';
import { Player } from './players/player';
import { PhysicalContainer } from './physics/containers/physical-container';
import { createDungeon } from './map/create-dungeon';
import { glMatrix } from 'gl-matrix';
import { DeltaTimeCalculator } from './helper/delta-time-calculator';

glMatrix.setMatrixArrayType(Array);

applyArrayPlugins();

Random.seed = 42;

const objects = new PhysicalContainer();
createDungeon(objects);
createDungeon(objects);
createDungeon(objects);
createDungeon(objects);

objects.initialize();

let players: Array<Player> = [];

const app = express();
const deltaTimeCalculator = new DeltaTimeCalculator();

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  }),
);

const port = 3000;
const server = new Server(app);
const io = ioserver(server);

/*
const log = (text: string) => {
  io.to('insights').emit('insights', text + '\n');
};
*/

app.get('/', function (req, res) {
  res.sendFile('dist/index.html', { root: '.' });
});

io.on('connection', (socket: SocketIO.Socket) => {
  socket.on(TransportEvents.PlayerJoining, () => {
    const player = new Player(objects, socket);
    players.push(player);
    socket.on(TransportEvents.PlayerToServer, (json: string) => {
      const command = deserialize(json);
      player.sendCommand(command);
    });

    socket.on('disconnect', () => {
      player.destroy();
      players = players.filter((p) => p !== player);
    });
  });

  socket.on('join', (room_name: string) => {
    socket.join(room_name);
  });
});

server.listen(port, () => {
  console.log(`server started at http://localhost:${port}`);
});

const handlePhysics = () => {
  const delta = deltaTimeCalculator.getNextDeltaTimeInMilliseconds();
  const step = new StepCommand(delta);

  objects.sendCommand(step);
  players.forEach((p) => p.sendCommand(step));

  const physicsDelta = deltaTimeCalculator.getDeltaTimeInMilliseconds();
  const sleepTime = settings.targetPhysicsDeltaTimeInMilliseconds - physicsDelta;
  if (sleepTime >= settings.minPhysicsSleepTime) {
    setTimeout(handlePhysics, sleepTime);
  } else {
    setImmediate(handlePhysics);
  }
};

handlePhysics();
