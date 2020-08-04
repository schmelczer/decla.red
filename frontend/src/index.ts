import { glMatrix } from 'gl-matrix';
import { Game } from './scripts/game';
import { applyArrayPlugins } from './scripts/helper/array';
import './styles/main.scss';

glMatrix.setMatrixArrayType(Array);
applyArrayPlugins();

/*
const tree = new BoundingBoxTree([
  new BoundingBox(300, 550, 150, 550, 'A'),
  new BoundingBox(400, 800, 50, 200, 'B'),
  new BoundingBox(450, 500, 175, 185, 'C'),
  new BoundingBox(100, 200, 100, 500, 'D'),
  new BoundingBox(750, 950, 450, 600, 'E'),
  new BoundingBox(940, 1000, -2, 180, 'F'),
  new BoundingBox(960, 1050, 50, 190, 'G'),
  new BoundingBox(150, 900, 0, 575, 'H'),
  new BoundingBox(-10000, 10000, -10000, 10000, 'I'),
]);

tree.print();
console.log(tree.findIntersecting(new BoundingBox(960, 1050, 50, 190, 'G')));
*/

try {
  new Game();
} catch (e) {
  console.error(e);
  alert(e);
}
