import { Id } from '../transport/identity';

export abstract class GameObject {
  constructor(public readonly id: Id) {}
}
