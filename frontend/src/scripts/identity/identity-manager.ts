import { Id } from './identity';
import { v4 } from 'uuid';

export class IdentityManager {
  public static generateId(): Id {
    return v4();
  }
}
