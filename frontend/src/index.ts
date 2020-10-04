import { glMatrix } from 'gl-matrix';
import io from 'socket.io-client';
import { TransportEvents } from '../../shared/src/transport/transport-events';
import { Configuration } from './scripts/config/configuration';
import { Game } from './scripts/game';
import { Random } from './scripts/helper/random';
import './styles/main.scss';

glMatrix.setMatrixArrayType(Array);

const main = async () => {
  await Configuration.initialize();

  const socket = io(Configuration.servers[0], {
    reconnectionDelayMax: 10000,
    transports: ['websocket'],
  });

  socket.on('reconnect_attempt', () => {
    socket.io.opts.transports = ['polling', 'websocket'];
  });

  socket.emit(TransportEvents.PlayerJoining, null);

  try {
    Random.seed = 42;
    await new Game().start();
  } catch (e) {
    console.error(e);
    alert(e);
  }
};

main();
