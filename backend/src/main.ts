import ioserver, { Socket } from 'socket.io';
import express from 'express';
import { Server } from 'http';
import cors from 'cors';

import { PlayerContainer } from './players/player-container';
import './index.html';
import { TransportEvents } from '../../shared/src/transport/transport-events';
import { Player } from './players/player';

const app = express();

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

const players = new PlayerContainer();

const log = (text: string) => {
  io.to('insights').emit('insights', text + '\n');
};

app.get('/', function (req, res) {
  res.sendFile('dist/index.html', { root: '.' });
});

io.on('connection', (socket: SocketIO.Socket) => {
  socket.on(TransportEvents.PlayerJoining, () => {
    log('player joined');

    const player = new Player(socket);
    players.addPlayer(player);

    socket.on(TransportEvents.PlayerSendingInfo, () => {});

    socket.on('disconnect', () => {
      log('player disconnected');

      players.removePlayerBySocketId(player.socketId);
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
