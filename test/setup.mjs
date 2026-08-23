// Production makes every vector an f64 Array before any module-level vector is allocated.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

for (const path of [
  '../shared/node_modules/gl-matrix',
  '../backend/node_modules/gl-matrix',
  '../frontend/node_modules/gl-matrix',
]) {
  require(path).glMatrix.setMatrixArrayType(Array);
}
