import { glMatrix } from 'gl-matrix';
import { Game } from './scripts/game';
import { Random } from './scripts/helper/random';
import './styles/main.scss';

glMatrix.setMatrixArrayType(Array);
Random.seed = 42;

const main = async () => {
  try {
    await new Game().start();
  } catch (e) {
    console.error(e);
    alert(e);
  }
};

main();
