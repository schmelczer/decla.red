import { SerializableClass, serializableMapping } from './serializable-mapping';

const MANGLE = '__serializable_type';

export const serializable = (type: SerializableClass): any => {
  if (!serializableMapping.has(type.name)) {
    serializableMapping.set(type.name, type);
  }

  Object.defineProperty(type, MANGLE, { value: type.name });
  Object.defineProperty(type.prototype, MANGLE, { value: type.name });

  return type;
};
