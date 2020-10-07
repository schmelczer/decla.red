import { DeserializableClass } from './deserializable-class';

/**
 * @internal
 */
export const serializableMapping = new Map<
  string,
  {
    constructor: DeserializableClass;
    overriden: boolean;
  }
>();
