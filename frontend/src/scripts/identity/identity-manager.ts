import { v4 } from 'uuid';
import { Id } from './identity';

export class IdentityManager {
  public static generateId(): Id {
    return v4();
  }
}
