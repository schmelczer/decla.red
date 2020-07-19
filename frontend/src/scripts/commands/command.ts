import { Typed } from '../transport/serializable';
import { Id } from '../identity/identity';

export abstract class Command extends Typed {
  target?: Id;
}
