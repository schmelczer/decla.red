import { glMatrix, vec2 } from 'gl-matrix';
import { Game } from './scripts/game';
import { applyArrayPlugins } from './scripts/helper/array';
import { Random } from './scripts/helper/random';
import TunnelShape from './scripts/shapes/types/tunnel-shape';
import './styles/main.scss';

glMatrix.setMatrixArrayType(Array);
applyArrayPlugins();

const testSDF = () => {
  Random.seed = 44;

  const objects: Array<TunnelShape> = [
    new TunnelShape(vec2.fromValues(20, 20), vec2.fromValues(40, 80), 10, 9),
    new TunnelShape(vec2.fromValues(40, 80), vec2.fromValues(60, 20), 9, 15),
  ];

  const getPixelValue = (position: vec2) => {
    /*const k = 0.15;
  let res = Math.pow(2, -k * (vec2.distance(position, vec2.fromValues(20, 20)) - 20));
  res += Math.pow(2, -k * (vec2.distance(position, vec2.fromValues(40, 80)) - 30));
  res += Math.pow(2, -k * (vec2.distance(position, vec2.fromValues(60, 20)) - 20));
  res = -Math.log2(res) / k;
  return -res;

  */
    let min = 1000;
    for (const t of objects) {
      min = Math.min(min, t.distance(position));
    }
    if (min < 0) {
      // min = Math.min(min, vec2.distance(position, vec2.fromValues(40, 80 - 31.62)) - 31.62);
    }
    return -min;
  };

  const width = 80;
  const height = 100;

  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  // set desired size of transparent image
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');

  const imageData = ctx.createImageData(width, height);

  const zeroes = [];
  for (let x = 0; x < width; x++) {
    console.log(x);
    for (let y = 0; y < height; y++) {
      const position = vec2.fromValues(x, y);
      const redIndex = y * (width * 4) + x * 4;
      const dist = getPixelValue(position);
      if (Math.abs(dist) < 1) {
        const blueIndex = y * (width * 4) + x * 4 + 2;
        zeroes.push(position);
        imageData.data[blueIndex] = 255;
      }
      imageData.data[redIndex + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  console.log(zeroes);
  const errors = [];
  for (let x = 0; x < width; x++) {
    console.log('verify ', x);

    for (let y = 0; y < height; y++) {
      const position = vec2.fromValues(x, y);
      const dist = getPixelValue(position);

      const nearestDist =
        zeroes.find((z) => Math.abs(vec2.distance(z, position) - dist) < 0.5)?.length > 0;
      if (nearestDist) {
        const greenIndex = y * (width * 4) + x * 4 + 1;
        imageData.data[greenIndex] = 255;
      } else if (dist >= 0) {
        const redIndex = y * (width * 4) + x * 4;
        errors.push(dist);
        imageData.data[redIndex] = 255;
      }
    }
  }

  console.log(errors);

  ctx.putImageData(imageData, 0, 0);
};

// testSDF();
// extract as new image (data-uri)

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
  Random.seed = 42;
  new Game();
} catch (e) {
  console.error(e);
  alert(e);
}
