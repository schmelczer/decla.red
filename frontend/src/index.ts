import { glMatrix } from 'gl-matrix';
import { Game } from './scripts/game';
import { applyArrayPlugins } from './scripts/helper/array';
import './styles/main.scss';

glMatrix.setMatrixArrayType(Array);
applyArrayPlugins();

try {
  new Game();
} catch (e) {
  alert(e);
}
