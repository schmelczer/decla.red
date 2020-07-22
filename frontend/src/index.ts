import './styles/main.scss';
import { Game } from './scripts/game';
import { applyArrayPlugins } from './scripts/helper/array';
import { glMatrix } from 'gl-matrix';

glMatrix.setMatrixArrayType(Array);
applyArrayPlugins();

new Game();
