import { GameObject } from 'shared';

export interface ReactsToCollision {
  onCollision(other: GameObject): void;
}

export const reactsToCollision = (a: any): a is ReactsToCollision =>
  a && 'onCollision' in a;
