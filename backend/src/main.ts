import ioserver, { Socket } from 'socket.io';
import express from 'express';
import { Server } from 'http';
import cors from 'cors';
import {
  applyArrayPlugins,
  Random,
  TransportEvents,
  deserializeCommand,
  StepCommand,
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

const app = express();

const deltaTimeCalculator = new DeltaTimeCalculator();

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  })
);

const port = 3000;
const server = new Server(app);
const io = ioserver(server);

const log = (text: string) => {
  io.to('insights').emit('insights', text + '\n');
};

app.get('/', function (req, res) {
  res.sendFile('dist/index.html', { root: '.' });
});

io.on('connection', (socket: SocketIO.Socket) => {
  socket.on(TransportEvents.PlayerJoining, () => {
    const player = new Player(objects, socket);
    socket.on(TransportEvents.PlayerToServer, (text: string) => {
      const command = deserializeCommand(JSON.parse(text));
      player.sendCommand(command);
    });

    socket.on('disconnect', () => {
      player.destroy();
    });
  });

  socket.on('join', (room_name: string) => {
    socket.join(room_name);
  });

  //socket.on('disconnect', () => {});
});

server.listen(port, () => {
  console.log(`server started at http://localhost:${port}`);
});

const handlePhysics = () => {
  const delta = deltaTimeCalculator.getNextDeltaTimeInMilliseconds();
  const step = new StepCommand(delta);

  objects.sendCommand(step);

  setTimeout(handlePhysics, 5);
};

handlePhysics();
