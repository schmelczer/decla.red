import { DeserializableClass } from './deserializable-class';

export const serializableMapping = new Map<
  string,
  {
    constructor: DeserializableClass;
    overridden: boolean;
  }
>();
