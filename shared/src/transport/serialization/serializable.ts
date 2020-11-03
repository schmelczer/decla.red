import { SerializableClass } from './serializable-class';
import { serializableMapping } from './serializable-mapping';

export const serializable = (type: SerializableClass): any => {
  if (!serializableMapping.get(type.name)) {
    serializableMapping.set(type.name, {
      constructor: type,
      overridden: false,
    });
  }

  Object.defineProperty(type, '__serializable_type', { value: type.name });
  Object.defineProperty(type.prototype, '__serializable_type', { value: type.name });

  return type;
};
