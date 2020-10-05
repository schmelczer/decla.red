import { glMatrix } from 'gl-matrix';
import { Game } from './scripts/game';
import './styles/main.scss';

glMatrix.setMatrixArrayType(Array);

const main = async () => {
  try {
    await new Game().start();
  } catch (e) {
    console.error(e);
    alert(e);
  }
};

main();
