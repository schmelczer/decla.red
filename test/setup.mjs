// Production calls glMatrix.setMatrixArrayType(Array) before anything else
// (backend/src/main.ts, frontend/src/index.ts), which makes every vector an f64
// Array instead of the default Float32Array. Without the same call here the
// suite pins the numerics of a build nobody ships — including module-level
// scratch vectors, which are allocated the moment a module is imported.
//
// One call per installed gl-matrix: the prebuilt shared bundle keeps gl-matrix
// external and resolves shared/node_modules, while the backend and frontend
// sources the tests import directly resolve their own copies.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

for (const path of [
  '../shared/node_modules/gl-matrix',
  '../backend/node_modules/gl-matrix',
  '../frontend/node_modules/gl-matrix',
]) {
  require(path).glMatrix.setMatrixArrayType(Array);
}
