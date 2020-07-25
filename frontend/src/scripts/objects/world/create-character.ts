import { vec3 } from 'gl-matrix';
import { ObjectContainer } from '../object-container';
import { Camera } from '../types/camera';
import { Character } from '../types/character';
import { CursorLight } from '../types/cursor-light';

export const createCharacter = (objects: ObjectContainer) => {
  const camera = new Camera();
  objects.addObject(camera);
  objects.addObject(new Character(camera));
  objects.addObject(new CursorLight(40, vec3.fromValues(0.67, 0.67, 0.33)));
};
