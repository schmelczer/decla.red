import { vec2, vec3 } from 'gl-matrix';
import { ObjectContainer } from '../object-container';
import { Camera } from '../types/camera';
import { Character } from '../types/character';
import { Lamp } from '../types/lamp';

export const createCharacter = (objects: ObjectContainer) => {
  const light = new Lamp(
    vec2.create(),
    40,
    vec3.fromValues(0.67, 0.0, 0.33),
    2
  );

  const camera = new Camera(light);
  objects.addObject(light);
  objects.addObject(camera);
  objects.addObject(new Character(camera));
};
