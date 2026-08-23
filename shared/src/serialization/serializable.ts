import { MANGLE, SerializableClass, serializableMapping } from './serializable-mapping';

export const serializable = (type: SerializableClass): any => {
  serializableMapping.set(type.name, type);
  Object.defineProperty(type.prototype, MANGLE, { value: type.name });
  return type;
};
