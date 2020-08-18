import { vec2, vec3 } from 'gl-matrix';
import { Objects } from '../objects';
import { Camera } from '../types/camera';
import { Character } from '../types/character';
import { Lamp } from '../types/lamp';
import { Physics } from '../../physics/physics';
import { GameObject } from '../game-object';

export const createCharacter = (
  objects: Objects,
  physics: Physics
): GameObject => {
  const light = new Lamp(
    vec2.create(),
    40,
    vec3.fromValues(0.67, 0.0, 0.33),
    2
  );

  const camera = new Camera();
  const character = new Character(physics, camera, light);
  objects.addObject(light);
  objects.addObject(camera);
  objects.addObject(character);

  return character;
};
