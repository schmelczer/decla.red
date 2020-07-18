import { GameObject } from './game-object';
import { Camera } from './types/camera';

export class ObjectContainer {
  private objects: Array<GameObject> = [];

  constructor(public camera: Camera) {}
}
