// Use production's f64 vector type in every package. The import-order regression separately
// verifies that physics constants also retain full precision before startup configures it.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

for (const path of [
  '../shared/node_modules/gl-matrix',
  '../backend/node_modules/gl-matrix',
  '../frontend/node_modules/gl-matrix',
]) {
  require(path).glMatrix.setMatrixArrayType(Array);
}
